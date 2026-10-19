import { useCallback, useEffect, useState } from 'react';

// Loads one thing from the API for a screen: { data, error, loading, reload, setData }.
// No retries and no fallback data: a failure is shown with `error` and the screen offers reload().
// `load` must be stable (wrap it in useCallback) or the effect re-runs every render.
export default function useResource(load) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [run, setRun] = useState(0);

  useEffect(() => {
    let live = true;
    load().then(
      (data) => { if (live) setState({ data, error: null, loading: false }); },
      (error) => { if (live) setState({ data: undefined, error, loading: false }); },
    );
    return () => { live = false; };
  }, [load, run]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, error: null, loading: true }));
    setRun((r) => r + 1);
  }, []);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);

  return { ...state, reload, setData };
}
