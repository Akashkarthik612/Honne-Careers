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

- `frontend/` — the only code so far: React 19 + Vite UI prototype of the P1 screens. All data is mocked.
- No backend yet. The plan is to reuse the Honne IQ backend stack and conventions (assumed FastAPI, Postgres + pgvector, Gemini, Render, GitHub Actions), but whether Honne Careers lives in the Honne IQ repo is open (Q1). Don't scaffold a backend without settling that.
- `project_sources/` — source material (founder's handwritten notes). Not code.

## Git branching

- `main` — production. Only receives merges from `test`; never commit to it directly.
- `test` — integration/staging. Feature branches merge here first.
- `feature/<short-name>` — one per new feature, branched from `test` and merged back into `test`.

Start work with `git switch test && git pull && git switch -c feature/<short-name>`. Promote to production by merging `test` into `main` once it's verified.

## Frontend commands

Run from `frontend/`:

```
npm install
npm run dev       # Vite dev server; /api is proxied to http://localhost:8000
npm run lint      # ESLint (react-hooks + react-refresh rules)
npm run build     # production build to dist/
npm run preview
```

There is no test runner yet.

## Frontend architecture

Ported from the Claude Design canvas "Honne Careers Landing Page" and the "Honne" design system; mirrors the conventions of the sibling Honne AI frontend (Vite, react-router, lucide-react, `@/` → `src/` alias, inline style objects). Tailwind is deliberately not used — its preflight reset breaks the design's inline SVG icons.

Routes (`src/App.jsx`): `/` landing, `/login` sign in, then inside `AppShell` (collapsible `Sidebar` + page): `/resumes` dashboard, `/new/template` → `/new/mode` → `/new/jd` → `/new/details` (wizard) or `/tailoring` (returning user), `/cv/:id` "Your CV is ready", `/profile`, `/settings`. `/home` redirects to `/resumes`. Auth isn't wired (AUTH-1), so all routes are open.

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

## Deploy

- **Frontend → Vercel.** Import the GitHub repo with **Root Directory = `frontend`**; `frontend/vercel.json` sets the Vite build, the SPA fallback (deep links like `/cv/cv1` serve `index.html`) and long caching for `/assets`. Production branch `main`; other branches get preview deploys.
- **Backend → Render** (not built yet). The frontend reads its URL from `VITE_API_BASE_URL` (see `frontend/.env.example`) through `apiUrl()` in `src/services/apiConfig.js`, which throws in a production build if it's unset. Set it in Vercel's environment variables, and allow the Vercel domains in the backend's CORS config.
