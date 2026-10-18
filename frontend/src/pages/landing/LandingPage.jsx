import { useEffect, useState } from 'react';
import LandingView from './LandingView';
import './landing.css';

// Landing page ported from the Claude Design canvas "Honne Careers Landing Page".
// LandingView.jsx holds the markup; this file owns the hero's rotating word.

const WORDS = ['replies.', 'referrals.', 'interviews.', 'offers.'];
const WORD_MS = 2400;

export default function LandingPage() {
  const [word, setWord] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), WORD_MS);
    return () => clearInterval(t);
  }, []);

  return <LandingView words={WORDS} wordShift={`${-1.08 * word}em`} />;
}
