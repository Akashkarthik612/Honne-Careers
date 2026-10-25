import { useCallback, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { NAV_OFFSET, ScrollContext, useReducedMotion } from './landingHooks';
import Agents from './sections/Agents';
import Builder from './sections/Builder';
import Closing from './sections/Closing';
import Hero from './sections/Hero';
import HonneIq from './sections/HonneIq';
import LearningLoop from './sections/LearningLoop';
import Nav from './sections/Nav';
import { RibbonDefs } from './sections/parts';
import Problem from './sections/Problem';
import Tailoring from './sections/Tailoring';
import Templates from './sections/Templates';
import './landing.css';

const SCROLL_S = 1.1;

// Landing page from the Claude Design canvas "Honne Careers Landing Page" (Landing.dc.html,
// "Landing v4 · Stripe direction"). Each section owns its own state, so the hero's demo loop and
// the scroll-driven scenes re-render only themselves. Lenis smooths wheel scrolling; with
// reduced motion it is off and nothing moves.
export default function LandingPage() {
  const reduce = useReducedMotion();
  const lenisRef = useRef(null);

  useEffect(() => {
    if (reduce) return undefined;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1 });
    lenisRef.current = lenis;
    return () => { lenis.destroy(); lenisRef.current = null; };
  }, [reduce]);

  const scrollTo = useCallback((target) => {
    const el = typeof target === 'string' ? document.getElementById(target) : null;
    if (typeof target === 'string' && !el) return;
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(el || target, { offset: el ? -NAV_OFFSET : 0, duration: SCROLL_S });
      return;
    }
    const y = el ? el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET : target;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
  }, [reduce]);

  return (
    <ScrollContext.Provider value={scrollTo}>
      <div className="hc-landing">
        <RibbonDefs />
        <Nav />
        <main>
          <Hero />
          <Problem />
          <Agents />
          <Tailoring />
          <HonneIq />
          <LearningLoop />
          <Builder />
          <Templates />
        </main>
        <Closing />
      </div>
    </ScrollContext.Provider>
  );
}
