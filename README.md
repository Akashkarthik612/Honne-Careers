# Honne Careers

An agentic AI SaaS for job seekers. Honne Careers tailors a truthful CV to each job description, then keeps every application, CV, JD, referral and note in one knowledge layer (**Honne IQ**), where specialised AI agents track, analyse and improve your search week by week.

> **Status:** prototype. Backend work starts at Phase 1 (CV studio beta). See [project_requirements.md](./project_requirements.md) for the full scope.

---

## Why

Job seekers apply "blind" for months: no referral, weak fit, no tracking, and no learning from what failed. There are around a thousand CV makers that do "paste JD → get CV". Almost none of them remember anything afterwards.

Honne Careers adds that memory:

1. **Truthful, JD-tailored CVs**: free, the table stakes.
2. **Honne IQ**: one knowledge layer that holds every application, CV, JD, referral and note.
3. **Specialised agents** that track, analyse and optimise the search every week.
4. **Your own agents**: users build custom agents for their own problems (for example, follow-ups).

**The promise:** never invent a skill, metric, role or experience. When something doesn't work, restart from where it failed, not from scratch.

Primary market: India (INR pricing).

## Features by phase

| Phase | What ships | Done when |
| :--- | :--- | :--- |
| **P1: CV studio (beta)** | Sign-in, profile, JD tailoring, chat edits, templates, PDF, fit analysis, save-on-download | The P1 acceptance criteria pass |
| P2: Honne IQ tracker | Application records, referrals, remarks, outcomes, CV versions, Google Drive and Notion connectors | The tracker is fed by real data |
| P3: Built-in agents | CV Writer, Analyst, Advisor, Strategist, plus a weekly report | A user gets a weekly report built from their own records |
| P4: Custom agents | Agent builder, tool permissions, preview before saving, up to 10 per user | A user saves and runs their own agent |

### P1: CV studio

- **Sign in** with Google, Microsoft, or email and password.
- **Build one profile** (the single source of truth) from a PDF or DOCX upload, pasted LaTeX, or a from-scratch form. Review and edit it before it's used.
- **Tailor to a JD**: paste a job description (up to 1,000 words) and watch four steps: reading the JD → matching experience → rewriting bullets → building the PDF. The most relevant experience goes first.
- **Edit by chat**: "Lead with ownership", "Keep it to one page". Each change creates a new CV version.
- **Two templates**: Jake's Resume and Elegant. Switching templates doesn't re-run the AI.
- **ATS-safe PDFs**: compiled with LaTeX, single column, text-selectable.
- **Fit analysis** with evidence behind every score:
  - *Keyword match %*: matched and missing JD terms.
  - *Experience match %*: per requirement, a level (Yes / Strong / Partial / None) and years.
  - *Narrative alignment %*: the JD's story compared with your CV's top third, plus one concrete suggestion.
- **Save on download**: downloading a PDF saves that CV version and its JD together as an application record.

### P3: Built-in agents

| Agent | Job |
| :--- | :--- |
| CV Writer | Tailors CVs (the P1 flow, as an agent) |
| Analyst | Reads logged CVs, JDs and replies; says what's working and what isn't |
| Advisor | Where to apply, who to ask for a referral, when to follow up |
| Strategist | Plans next week from what went wrong this week |

The weekly report answers three questions: are you applying blind, were your "sure shot" applications really high-fit, and what is the optimised plan for next week.

## Truthfulness rules

"Nothing invented" is enforced in code, not left to the prompt.

- Every skill, employer, title, date, metric and project in a generated CV must trace back to a profile field.
- A deterministic checker runs **after** generation and matches skills, numbers, employers and dates against the profile.
- A CV that fails the check is never shown as ready.
- Rewording is allowed. New facts are not. If the profile has no metric, the bullet has no metric.
- A JD skill missing from the profile is listed as missing ("not in your profile, so we didn't add it"), never added.

## How it's built

**LLM for judgment, Python for mechanics, JSON between machines.**

| Task | Owner |
| :--- | :--- |
| Parse PDF / DOCX / LaTeX to text | Python |
| Text → structured profile | LLM (JSON schema), validated by Python |
| Extract JD requirements, skills, company, role | LLM (JSON) |
| Keyword match %, years of experience | Python |
| Requirement levels, bullet rewriting, relevance ordering | LLM (JSON with evidence) |
| Truthfulness check | Python |
| Template rendering, escaping, LaTeX compile | Python |
| Blind / sure-shot classification | Python |
| Weekly report narrative | LLM over Python-computed stats |

**Planned stack** (not final; it reuses the Honne IQ backend): FastAPI, Postgres with pgvector, Gemini, Render, GitHub Actions.

### Non-negotiables

- **Privacy:** CVs are personal data, so the design follows India's DPDP Act and the EU GDPR. Connector tokens are encrypted, no CV or JD content goes into logs, and deleting an account removes all of its data.
- **Security:** user text is escaped before it goes into a template. Pasted LaTeX is parsed for content only and never compiled, with no shell-escape. Agents can only call tools the user granted them, and Gmail access is draft-only.
- **Reliability:** a tailoring job survives a restart or is marked failed. It is never stuck on "generating".
- **Observability:** structured logs with a correlation id per job or agent run.
- **Testing:** unit and integration tests run in CI, with no real Gemini or Google calls. The truthfulness checker has golden tests.

## Plans

Everything is free during the beta, with no card required. Billing is out of scope until after user testing. Prices and plan features are still being decided.

| Plan | Includes |
| :--- | :--- |
| Free | Paste JD → tailored CV; CV and JD saved together on download |
| Plus | To be decided |
| Pro | Honne IQ, Drive and Notion connectors, stored past applications, specialised agents with a weekly analysis |
| Pro+ | Everything in Pro, plus more specialised agents and up to 10 custom agents |

## Not in scope (yet)

- Payments and billing
- Classic and Modern templates
- Auto-applying to jobs, or sending email on the user's behalf
- OCR for scanned CVs

## Repository docs

| File | What it covers |
| :--- | :--- |
| [project_requirements.md](./project_requirements.md) | What to build and why: requirements with stable IDs, open questions, P1 acceptance criteria |
| [guardrails.md](./guardrails.md) | How work is planned and written here: LLD order, no silent fallbacks, logging, cost |
| [project_sources/](./project_sources/) | Source material: the founder's handwritten notes (features, pricing, agents, beta plan) |
| [frontend/](./frontend/) | React + Vite app: landing page, sign-in, CV studio, create-from-scratch profile |

## License

[MIT](./LICENSE) © 2026 Akash Balamurugan
