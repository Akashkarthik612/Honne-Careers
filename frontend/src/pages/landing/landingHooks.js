import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Shared plumbing for the landing sections: media queries, reveal-on-scroll and the
// smooth-scroll helper that LandingPage provides (Lenis when motion is allowed).

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const NARROW = '(max-width: 899px)';
export const NAV_OFFSET = 64;

export function useMedia(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMedia(REDUCED_MOTION);

// True once the element has been 12% on screen; stays true (the reveal plays once).
export function useReveal() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

// True while the element is on screen; used to pause looping demos that nobody can see.
export function useOnScreen(margin = '0px') {
  const ref = useRef(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([en]) => setOn(en.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, on];
}

// scrollTo(id | y): to a section (below the sticky nav) or to a page offset.
export const ScrollContext = createContext((target) => {
  const y = typeof target === 'number' ? target : document.getElementById(target)?.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top: Math.max(0, y || 0), behavior: 'smooth' });
});

export const useScrollTo = () => useContext(ScrollContext);

// onClick for an in-page link: keeps the #hash href for no-JS / new tab, scrolls smoothly otherwise.
export function useJump(after) {
  const scrollTo = useScrollTo();
  return (id) => (e) => {
    e.preventDefault();
    after?.();
    scrollTo(id);
  };
}
