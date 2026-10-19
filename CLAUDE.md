# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

Before planning or coding, read [project_requirements.md](./project_requirements.md) (what to build, requirement IDs like `TAIL-3`, open questions `Q1`–`Q14`) and [guardrails.md](./guardrails.md) (how to plan and write code here), plus the current `Day_N.md` if one is attached. Guardrails is binding; the short version:

- Plans have three parts: goal + LLD, reasoning together (SOLID, tradeoffs, edge cases, fallbacks), second-brain check. Tables over prose; concise.
- LLD order: data classes → operation classes → pattern + SOLID principle per class → data structures. Don't write code before the LLD is agreed.
- No silent fallbacks: every fallback is raised in the plan first; default is to fail loudly with a specific exception. No bare `except`. Retries bounded and configured; log at WARNING+.
- Structured logs with a correlation id, `user_id` and entity id; never log CV/JD content, secrets or tokens.
- Give time/space complexity and cost per operation in plans.
- Reference requirement IDs (e.g. `PROF-4`, `TRUTH-2`) in plans, code comments and `Day_N.md`. Items marked ⚠ Q# are undecided — don't design past them without asking.

## Domain

Honne Careers: truthful JD-tailored CVs (P1, free), then Honne IQ (application tracker / knowledge layer, P2), built-in agents with a weekly report (P3), user-built custom agents (P4). Primary market India.

The product promise drives the design: **nothing invented**. Every skill, employer, title, date, metric and project in a generated CV must trace to a profile field, checked deterministically in Python after generation (TRUTH-1…4). LLM for judgment, deterministic Python for mechanics, JSON between machines, prose only at the user boundary — see the task-ownership table in project_requirements.md §8.

## Repository state

- `frontend/` — React 19 + Vite UI of the P1 screens. Google sign-in is live (Supabase Auth); app data is still mocked (see "Frontend ↔ backend wiring" below).
- `backend/` — Python 3.12 + FastAPI, P1 feature 1 (Day_1.md). Lives in this repo (Q1 settled 18 Oct 2026).
- `supabase/migrations/` — schema, RLS (enabled + forced on every table), grants, storage policies. Never edit a migration once applied; add a new one.
- `render.yaml` — Render Blueprint: free Static Site (frontend) + one paid Docker web service (FastAPI + Tectonic LaTeX). No Vercel.
- `project_sources/` — source material (founder's handwritten notes). Not code.

## Stack (decided 18 Oct 2026)

Render (static frontend + Docker API with LaTeX in the same image) · Supabase (Postgres with RLS, Auth with Google only in the beta — GitHub shown as "Coming soon", Storage) · Gemini now, via a provider adapter (OpenAI/Claude later = one new adapter + env change) · GitHub Actions. LangGraph is planned for P3/P4 multi-agent work, which is why the backend stays Python.

## Backend commands

Run from `backend/`:

```
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # bin/ on Linux/macOS
cp .env.example .env                 # fill in; see backend/README.md
uvicorn app.main:app --reload --port 8000
pytest -q                            # DB tests need DATABASE_URL_TEST (superuser of a throwaway Postgres)
pytest tests/unit/test_latex.py::test_name -q   # single test; or -k <expr>
pytest -m "not db" -q                # skip tests that need Postgres
ruff check app tests docker && bandit -q -r app -c pyproject.toml && pip-audit --skip-editable
```

Tests: `tests/unit`, `tests/golden` (truth-check cases), `tests/integration` (API + RLS against real Postgres). Markers: `db` tests are skipped when `DATABASE_URL_TEST` is unset, and `latex` tests are skipped when `tectonic` is not on `PATH`. `tests/fakes.py` holds the fakes the container is built with, and `tests/docs.py` builds real PDF/DOCX upload fixtures. CI (`.github/workflows/backend.yml`, runs on PRs and on pushes to `test`/`main` that touch `backend/` or `supabase/`) runs lint + pytest against a Postgres 16 service with no real Supabase or Gemini, then pip-audit + bandit, then builds the Docker image and runs `docker/smoke_compile.py` with networking off (offline LaTeX compile + peak RSS). It also checks that the image runs as non-root.

## Backend architecture

`api → services → (repositories, agents, truth, render, ingest, storage, policy) → domain`; `app/container.py` is the composition root (tests build it with fakes). Rules that are easy to break:
- **Tenancy is enforced twice.** Every DB call goes through `UnitOfWork` (`app/db`), which does `SET LOCAL ROLE authenticated` + JWT claims so RLS applies; repositories also filter by `user_id`. The login role `honne_backend` owns nothing. Another user's id → 404, never 403.
- **Client input shapes (`*In`) carry ids + text only.** `EditStamper` stamps `origin`/`locked` server-side (B5). Never accept origin/locked from a client.
- **The model never writes LaTeX or structural fields.** Agents return JSON; `TruthChecker` checks AI output against `FactSet` (item-scoped numbers, skills, dates, names); `ResumeMerger` drops edits to locked bullets and keeps originals for violations.
- **Agents are config** (`backend/agents/*.yaml` + `backend/prompts/`). `AgentRunner` owns retries, untrusted-data wrapping and the `agent_runs` record. Add an agent by adding files, not code.
- **No transaction is held across an LLM call, compile or storage call.** Services: short UoW → slow call → short UoW with optimistic concurrency.
- Never log CV/JD text; `tests/integration/test_logging_privacy.py` enforces it.

## Git branching

- `main` — production. Only receives merges from `test`; never commit to it directly.
- `test` — integration/staging. Feature branches merge here first.
- `feature/<short-name>` — one per new feature, branched from `test` and merged back into `test`.

Start work with `git switch test && git pull && git switch -c feature/<short-name>`. Promote to production by merging `test` into `main` once it's verified.

## Frontend commands

Run from `frontend/`:

```
npm install
npm run dev       # Vite dev server; /api is proxied to http://localhost:8000 (the backend)
npm run lint      # ESLint (react-hooks + react-refresh rules)
npm run build     # production build to dist/
npm run preview
```

There is no test runner yet.

## Frontend architecture

Ported from the Claude Design canvas "Honne Careers Landing Page" and the "Honne" design system; mirrors the conventions of the sibling Honne AI frontend (Vite, react-router, lucide-react, `@/` → `src/` alias, inline style objects). Tailwind is deliberately not used — its preflight reset breaks the design's inline SVG icons.

Routes (`src/App.jsx`): `/` landing, `/login` sign in, `/auth/callback` (Google returns here), then inside `RequireAuth` + `AppShell` (collapsible `Sidebar` + page): `/resumes` dashboard, `/new/template` → `/new/mode` → `/new/jd` → `/new/details` (wizard) or `/tailoring` (returning user), `/cv/:id` "Your CV is ready", `/profile`, `/settings`. `/home` redirects to `/resumes`.

Auth (AUTH-1, beta = Google only):
- `src/services/supabaseClient.js` — the one supabase-js client (PKCE). Throws at load if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are missing; no placeholder fallback.
- `src/services/authService.js` — `signInWithGoogle`, `completeSignIn`, `signOut`, `safeNext` (same-site paths only), typed `AuthError`. The post-login path lives in sessionStorage so `redirectTo` is always exactly `<origin>/auth/callback` (must be in Supabase's redirect allowlist).
- `src/state/AuthProvider.jsx` + `auth.js` (`useAuth`) — mirrors `onAuthStateChange`; status `checking`/`authed`/`anon`. Tokens stay inside supabase-js; nothing is copied to localStorage.
- `src/components/RequireAuth.jsx` guards the app; `AuthCallbackPage` checks the session, then calls `GET /me` (creates the account row) before entering.
- `src/services/apiClient.js` — `apiRequest` for every backend call: Bearer token + `X-Correlation-Id`, backend error JSON → `ApiError`, a 401 forgets the session. No retries.

Styling has two separate layers — keep them separate:
- **Landing** (`src/pages/landing/`): `LandingView.jsx` is markup machine-converted from the design's `Main.dc.html`; `LandingPage.jsx` owns state (the rotating hero word). Its CSS in `landing.css` is scoped under `.hc-landing`, and its keyframes are prefixed `lp-`, because its class names (`.br`, `.rise`, `.dot`…) are generic. Hex colours are inline literals, as in the design.
- **App screens**: shared `hc-` prefixed classes and `--hc-*` design tokens in `src/index.css` (tokens come from the design system's `tokens.json`). Use the tokens rather than new hex values.

Data (all mocked, session-only):
- `src/state/` — `AppStoreProvider` holds profile, resumes, the new-resume draft and settings; screens use `useAppStore()`. `?user=new` on first load starts as a first-time user (no profile, no resumes).
- `src/data/cvModel.js` — pure helpers between three shapes: **profile** (the user's facts, PROF-1), **doc** (a resume: per bullet `source` = profile fact, `text` = CV wording, `status` plain/edited/busy/review/kept) and **cv** (what `CvDoc` renders). `docToProfile` saves facts only, never tailored wording.
- `src/services/mockApi.js` — backend seams (`tailorBullet`, `buildPdf`, `runAnalysis`) that throw specific errors (`TailorUnavailableError`, `TruthCheckError`, `PdfBuildError`). `?sim=ai-error|truth-error|pdf-error` forces each failure.
- `src/hooks/useTailorJob.js` — simulated 4-step tailoring job (TAIL-3); swap the interval for the real job.
- `src/data/sampleCv.js` — the design's sample profile, tailored bullets and JD.

`src/components/CvDoc.jsx` renders a CV (`focus` highlights the section being edited; `CvThumb` is the scaled card thumbnail). Only Jake's Resume is live; Elegant, Classic and Modern are "Coming soon" (`src/data/templates.js`). Chat edits (CHAT-1…4) are not in this design and have no UI. The PDF isn't generated yet (`TODO(SAVE-1)`).

## Frontend ↔ backend wiring (status 19 Oct 2026)

Auth is wired (sign in, sign out, `GET /me`, `DELETE /me`). Everything else still runs on `src/state/appStore.js` (seeded from `sampleCv.js`) and `mockApi.js`. Remaining mock → endpoint map:

| Screen / seam | Mock today | Backend endpoint |
|---|---|---|
| Dashboard, duplicate, delete | `appStore` seeded resumes | `GET/POST /resumes`, `POST /resumes/{id}/duplicate`, `DELETE /resumes/{id}` |
| Template picker | local `templates.js`, sample-profile thumbnail | `GET /templates` |
| Profile page | `SAMPLE_PROFILE` | `GET/PUT /profile`, `POST /resumes/{id}/save-to-profile` |
| JD page + CV upload | stores only the file name; wizard then loads `SAMPLE_PROFILE` | `POST /uploads` (PDF/DOCX), `POST /uploads/latex`, `PUT /resumes/{id}/jd` |
| Wizard autosave | in-memory draft | `PATCH /resumes/{id}` (409 on stale version) |
| Per-bullet tailor, Keep/Revert (`mockApi.tailorBullet`) | returns `SAMPLE_TAILORED` text | `POST /resumes/{id}/bullets/{bid}/tailor`, `.../{keep|revert}` |
| Returning-user tailoring (`useTailorJob`, `TailoringPage`) | `setInterval` 4-step timer + `SAMPLE_TAILORED`; missing skills from `SAMPLE_JD_SKILLS` | `POST /resumes/{id}/tailor` (202) then poll `GET /resumes/{id}` |
| PDF (`mockApi.buildPdf`) | fake | `POST /resumes/{id}/pdf` |
| Analysis (`mockApi.runAnalysis`) | fake scores | `POST /resumes/{id}/analysis` |

Path prefix (decided): backend routes have no `/api` prefix. In dev `apiUrl()` returns `/api/...` and the Vite proxy strips `/api`; in production it uses `VITE_API_BASE_URL` directly. Call `apiRequest('/resumes')`, never `'/api/resumes'`.

Known mismatches to fix while wiring:
- **Client shapes.** The frontend's `doc` (per-bullet `status` plain/edited/busy/review/kept) is not the backend's resume model (server-stamped `origin`/`locked`, B5). Map in one adapter; never send origin/locked from the client.
- **Errors.** Replace `TailorUnavailableError` / `TruthCheckError` / `PdfBuildError` with mappings from the backend's error responses; keep `?sim=` only for UI development.

## Deploy

Both run on Render from `main` via `render.yaml` (Blueprint): the API as a Docker web service (`rootDir: backend`, Singapore, `/health` check, secrets in the `honne-careers-api-secrets` env group) and the frontend as a free Static Site (`rootDir: frontend`, SPA rewrite, CSP and security headers). Not deployed yet: it needs a Supabase project plus the Render secrets (Day_1.md C1 #10).

The frontend reads the API URL from `VITE_API_BASE_URL` (set in `render.yaml`; see `frontend/.env.example`) through `apiUrl()` in `src/services/apiConfig.js`, which throws in a production build if it's unset. Keep the static site's domain in the API's `CORS_ORIGINS` (never `*`; config rejects it). The CSP `connect-src` must list the API and `*.supabase.co`. The static site also needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (`sync: false` in `render.yaml`, set in the dashboard).
