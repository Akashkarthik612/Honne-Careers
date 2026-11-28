import { useEffect, useRef, useState } from 'react';
import { getUsage } from '@/services/api';
import { useAuth } from '@/state/auth';
import './betaUsage.css';

const FEATURES = {
  full_tailor: 'CV tailoring',
  analysis: 'ATS analysis',
  chat_message: 'agent questions',
};

export default function BetaUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [limit, setLimit] = useState(null);
  const dialog = useRef(null);
  const seen = useRef(null);

  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const result = await getUsage();
        if (!active || current !== request) return;
        setUsage(result);
        const exhausted = Object.keys(FEATURES).every((key) =>
          result.items.some((item) => item.key === key && item.used >= item.limit));
        if (exhausted && seen.current !== result.resets_at) {
          const key = `beta-limit:${user?.id}:${result.resets_at}`;
          seen.current = result.resets_at;
          let alreadySeen = false;
          try {
            alreadySeen = sessionStorage.getItem(key) === '1';
            sessionStorage.setItem(key, '1');
          } catch { /* Fall back to remembering this in the current session. */ }
          if (!alreadySeen) setLimit('all');
        }
      } catch {
        // A missed refresh leaves the last confirmed counts visible.
      }
    };
    const showLimit = (event) => { setLimit(event.detail); refresh(); };
    const interval = window.setInterval(refresh, 15000);
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('honne-beta-usage', refresh);
    window.addEventListener('honne-beta-limit', showLimit);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('honne-beta-usage', refresh);
      window.removeEventListener('honne-beta-limit', showLimit);
    };
  }, [user?.id]);

  useEffect(() => {
    if (limit && !dialog.current?.open) dialog.current?.showModal();
  }, [limit]);

  const find = (key) => usage?.items.find((item) => item.key === key);
  const cv = find('full_tailor');
  const ats = find('analysis');
  const chat = find('chat_message');

  return (
    <>
      {cv && (
        <section className="hc-beta-usage" aria-label="Daily beta usage">
          <div>
            <div className="hc-lbl">Free beta · Daily usage</div>
            <strong>{cv.used} of {cv.limit} CVs tailored today</strong>
          </div>
          <div className="hc-beta-segments" role="progressbar" aria-label="CVs tailored today"
            aria-valuenow={cv.used} aria-valuemin={0} aria-valuemax={cv.limit}>
            {Array.from({ length: cv.limit }, (_, index) => (
              <span key={index} data-filled={index < cv.used} aria-hidden="true">{index + 1}</span>
            ))}
          </div>
          <div className="hc-beta-other">
            {ats && <span>ATS {ats.used}/{ats.limit}</span>}
            {chat && <span>Agent questions {chat.used}/{chat.limit}</span>}
          </div>
        </section>
      )}
      <dialog ref={dialog} className="hc-beta-dialog" aria-labelledby="beta-limit-title"
        onClose={() => setLimit(null)}>
        <h2 id="beta-limit-title" className="hc-disp">You’ve reached your daily beta limit</h2>
        <p>{limit === 'all'
          ? 'Sorry, you’ve used all of today’s beta allowances.'
          : `Sorry, you’ve used today’s allowance for ${FEATURES[limit] ?? 'this feature'}.`}</p>
        <p>Daily limits reset at midnight IST. The full version launches December 7. Thanks for trying Honne Careers while we improve the app.</p>
        <form method="dialog"><button className="hc-btn-p" autoFocus>Got it</button></form>
      </dialog>
    </>
  );
}
