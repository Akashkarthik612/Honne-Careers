import { HonneMark } from '@/components/HonneMark';
import { agentInitials } from '@/data/chatAdapter';

// An agent's tile in chat, the @ picker and on cards (design: Chat.dc.html). Honne's agents wear the
// mark; the user's own agents get a dashed tile with their initials.
export default function AgentAvatar({ agent, size = 30 }) {
  const mine = agent?.kind === 'user';
  return (
    <span className={`hc-av${mine ? ' is-user' : ''}`} aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      {agent?.kind === 'builtin' ? <HonneMark width={Math.round(size * 0.66)} height={Math.round(size * 0.55)} /> : agentInitials(agent?.handle ?? '?')}
    </span>
  );
}
