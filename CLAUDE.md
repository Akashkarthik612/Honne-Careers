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

Routes (`src/App.jsx`): `/` landing, `/login` sign in, `/home` CV studio, `/profile` create-from-scratch. Auth isn't wired (AUTH-1), so all routes are open and sign-in just navigates to `/home`.

Styling has two separate layers — keep them separate:
- **Landing** (`src/pages/landing/`): `LandingView.jsx` is markup machine-converted from the design's `Main.dc.html`; `LandingPage.jsx` owns state (the rotating hero word). Its CSS in `landing.css` is scoped under `.hc-landing`, and its keyframes are prefixed `lp-`, because its class names (`.br`, `.rise`, `.dot`…) are generic. Hex colours are inline literals, as in the design.
- **App screens** (sign in, studio, profile): shared `hc-` prefixed classes and `--hc-*` design tokens in `src/index.css` (tokens come from the design system's `tokens.json`). Use the tokens rather than new hex values.

CV studio (`src/pages/studio/`) is a phase machine owned by `StudioPage.jsx`: `new` (add a CV) → `profile` (saved) → `gen` (tailoring job running) → `ready` (preview, chat edits, analysis). `?state=new|profile|ready|chat` opens a phase directly (the design's three "App home" artboards). Backend seams, each a mock to replace:
- `useTailorJob.js` — simulated 4-step tailoring job (TAIL-3); swap the interval for polling/streaming the real job.
- `AnalysisSection.jsx` — sample scores for the three analyses (ANA-1…3).
- `src/data/sampleCv.js` — the design's sample CV, JD and profile file name.
- "Download PDF" has no handler yet (`TODO(SAVE-1)`).

`src/components/CvDoc.jsx` renders a CV in the two P1 templates (`src/data/templates.js`); switching template only restyles (PDF-1: no LLM re-run). The profile page builds its live preview by mapping form state into the same CV shape.
