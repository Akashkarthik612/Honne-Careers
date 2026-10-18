// Where API calls go. In dev, '' keeps requests same-origin so Vite's /api proxy reaches the local backend.
// In a production build the Render URL must be set (VITE_API_BASE_URL); a missing value fails loudly
// on the first API call instead of silently calling the Vercel origin.

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function apiUrl(path) {
  if (!path.startsWith('/')) throw new Error(`API path must start with "/": ${path}`);
  if (import.meta.env.PROD && !BASE) throw new Error('VITE_API_BASE_URL is not set for this build');
  return `${BASE}${path}`;
}
