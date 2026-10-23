import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_POLL_MAX, CHAT_POLL_MS } from '@/config/limits';
import { toChat, toMessage, toStartedTurn, upsertMessage } from '@/data/chatAdapter';
import { getChat, getChatMessage, retryChatTurn, sendChatMessage } from '@/services/api';

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Polls one running answer until it is 'ok' or 'failed', or maxPolls run out. Pure (fetch and sleep
// injected) so it is tested without React, like pollTailorJob. A failed request throws (ApiError): there
// is no silent retry. Returns { outcome: 'ok' | 'failed' | 'timeout' | 'cancelled', message }.
export async function pollChatTurn({ fetchMessage, onUpdate, isCancelled, intervalMs = CHAT_POLL_MS, maxPolls = CHAT_POLL_MAX, sleep = wait }) {
  let message = null;
  for (let n = 0; n < maxPolls; n += 1) {
    if (isCancelled()) return { outcome: 'cancelled', message };
    message = await fetchMessage();
    onUpdate(message);
    if (message.status !== 'running') return { outcome: message.status, message };
    await sleep(intervalMs);
  }
  return { outcome: 'timeout', message };
}

const POLL_TIMEOUT = { code: 'poll_timeout', message: 'This is taking longer than it should. Reopen the chat in a minute to see the answer.' };

// One chat: load it, send (202 → poll the running answer), retry a failed answer, stop watching.
// chatId null = a new chat: the first send creates it and onCreated(id) lets the page move to /chat/:id
// without reloading (the poll keeps going). A chat reopened with a running answer resumes polling it.
// "Stop" only stops watching: the server finishes the turn, and it shows when the chat is reopened.
export default function useChat(chatId, { onCreated } = {}) {
  const [view, setView] = useState({ for: chatId, chat: null, loading: Boolean(chatId), loadError: null });
  const [createdId, setCreatedId] = useState(null);
  const [watching, setWatching] = useState(null);   // id of the answer being polled
  const [error, setError] = useState(null);         // send / poll failure, shown with Retry
  const [reloads, setReloads] = useState(0);
  const current = useRef(chatId);                   // the chat on screen, for polls to check
  const watchToken = useRef(0);

  // Another chat was opened: reset during render (React's "adjust state on prop change"), then load.
  if (view.for !== chatId) {
    const keep = chatId != null && chatId === createdId;  // the chat this screen just made
    setView(keep ? { ...view, for: chatId } : { for: chatId, chat: null, loading: Boolean(chatId), loadError: null });
    // Leaving the chat this screen made: forget it, so reopening it later loads it from the server.
    if (!keep) { setWatching(null); setError(null); setCreatedId(null); }
  }

  useEffect(() => {
    current.current = chatId;
    return () => { current.current = null; };      // unmount (or switch): polls for it stop
  }, [chatId]);

  const watch = useCallback((cid, messageId) => {
    const token = ++watchToken.current;
    const stale = () => token !== watchToken.current || current.current !== cid;
    setWatching(messageId);
    pollChatTurn({
      fetchMessage: async () => toMessage(await getChatMessage(cid, messageId)),
      onUpdate: (m) => { if (!stale()) setView((v) => (v.chat ? { ...v, chat: { ...v.chat, messages: upsertMessage(v.chat.messages, m) } } : v)); },
      isCancelled: stale,
    }).then(
      ({ outcome }) => {
        if (stale()) return;
        setWatching(null);
        if (outcome === 'timeout') setError(POLL_TIMEOUT);
      },
      (e) => { if (!stale()) { setWatching(null); setError(e); } },
    );
  }, []);

  useEffect(() => {
    if (!chatId || chatId === createdId) return undefined;
    let cancelled = false;
    getChat(chatId).then(
      (r) => {
        if (cancelled) return;
        const chat = toChat(r);
        setView({ for: chatId, chat, loading: false, loadError: null });
        const running = chat.messages.find((m) => m.status === 'running');
        if (running) watch(chat.id, running.id);
      },
      (e) => { if (!cancelled) setView({ for: chatId, chat: null, loading: false, loadError: e }); },
    );
    return () => { cancelled = true; };
  }, [chatId, createdId, reloads, watch]);

  const reload = useCallback(() => {
    setCreatedId(null);
    setView((v) => ({ ...v, loading: true, loadError: null }));
    setReloads((n) => n + 1);
  }, []);

  function begin(started) {
    setView((v) => {
      const base = v.chat && v.chat.id === started.chat.id ? v.chat : { ...started.chat, turnsMax: null, longWarnTurns: null, messages: [] };
      const messages = upsertMessage(upsertMessage(base.messages, started.userMessage), started.answer);
      return { ...v, chat: { ...base, ...started.chat, messages } };
    });
    watch(started.chat.id, started.answer.id);
  }

  async function send(message, agent) {
    setError(null);
    try {
      const started = toStartedTurn(await sendChatMessage(view.chat?.id ?? null, { message, agent }));
      if (!view.chat) {
        current.current = started.chat.id;          // keep polling through the URL change
        setCreatedId(started.chat.id);
        setView((v) => ({ ...v, for: started.chat.id }));
        onCreated?.(started.chat.id);
      }
      begin(started);
      return true;
    } catch (e) {
      setError(e);
      return false;
    }
  }

  async function retry() {
    setError(null);
    try {
      begin(toStartedTurn(await retryChatTurn(view.chat.id)));
    } catch (e) {
      setError(e);
    }
  }

  function stop() {
    watchToken.current += 1;
    setWatching(null);
  }

  const chat = view.chat;
  const turns = chat?.turnCount ?? 0;
  return {
    chat, loading: view.loading, loadError: view.loadError, reload, error, clearError: () => setError(null),
    send, retry, stop, busy: Boolean(watching),
    // Limits come with a loaded chat; a chat made on this screen gets them on its next load.
    full: chat?.turnsMax != null && turns >= chat.turnsMax,
    long: chat?.longWarnTurns != null && turns >= chat.longWarnTurns,
  };
}
