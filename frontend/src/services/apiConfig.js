// Where API calls go. Backend routes have no /api prefix (/me, /resumes…).
// Dev: VITE_API_BASE_URL unset → '/api', which Vite proxies to http://localhost:8000 with the prefix
// stripped (vite.config.js), so there's no CORS in local dev.
// Production build: the Render API URL must be set (render.yaml); a missing value fails loudly on the
// first API call instead of silently calling the static site's own origin.

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '') || (import.meta.env.PROD ? '' : '/api');

export function apiUrl(path) {
  if (!path.startsWith('/')) throw new Error(`API path must start with "/": ${path}`);
  if (import.meta.env.PROD && !BASE) throw new Error('VITE_API_BASE_URL is not set for this build');
  return `${BASE}${path}`;
}
