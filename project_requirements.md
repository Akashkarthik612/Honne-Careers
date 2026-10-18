# Project Requirements: Honne Careers

Scope for the Honne Careers backend. Read with [CLAUDE.md](./CLAUDE.md) (domain, stack), [guardrails.md](./guardrails.md) (how Claude works) and the current `Day_N.md`. This file says **what** to build and **why**; the LLD (guardrails §2) says how.

**Sources:** founder notes (4 handwritten pages, 17 Oct 2026; photos in [project\_sources/](./project_sources/)); design canvas *Honne Careers Landing Page* (landing, sign-in, app home in 3 states, create-from-scratch, CV component); *Honne* design system; existing *Honne IQ Day 5 LLD*. **Status:** prototype. Items marked **⚠ Q\#** need a decision (§12) before their LLD.

---

## 1\. Problem and positioning

|  |  |
| :---- | :---- |
| Problem | Job seekers apply "blind" for months: no referral, weak fit, no tracking, no learning from what failed. The market after the AI boom punishes this. |
| What exists | \~1,000 CV makers that do "paste JD → get CV". Almost none have a **knowledge layer**. |
| Honne Careers | 1\. Truthful JD-tailored CVs (table stakes, free). 2\. **Honne IQ**: one knowledge layer holding every application, CV, JD, referral and note. 3\. **Specialised agents** that track, analyse and optimise the search weekly. 4\. **Users create their own agents** (USP; "no one has this"). |
| Promise the backend must keep | Never invent a skill, metric, role or experience. Restart from where it didn't work, not from scratch. |
| Primary market | India (INR pricing). Origin of the data: job searches in Paris, Berlin and India. |

## 2\. Users

| User | Need | Phase |
| :---- | :---- | :---- |
| Beta user (community) | Tailored CV per JD, free, no card | P1 |
| Active job seeker | Track applications \+ referrals, see what's working | P2–P3 |
| Power user | Custom agents for their own problems (e.g. follow-ups) | P4 |
| Founders | Learn how users search; turn it into features | P1+ |

## 3\. Product surface (from the UI)

| Screen (artboard) | Backend it needs | Phase |
| :---- | :---- | :---- |
| Landing page | Beta sign-up only | P1 |
| Sign in | Google SSO, Microsoft SSO, email \+ password, forgot password | P1 |
| App home · New user | CV upload (PDF, DOCX), LaTeX import, link to create-from-scratch | P1 |
| Create CV from scratch | Profile CRUD (personal, experience\[\], projects\[\], education\[\], skills), live preview | P1 |
| App home · CV ready | Tailor job with progress steps, preview, template switch, PDF download, 3-score analysis | P1 |
| App home · Making changes | Chat edits that regenerate the CV | P1 |
| Nav: Honne IQ (SOON) | Application tracker, connectors | P2 |
| Nav: Agents (SOON) | Built-in agents, weekly report, custom agent builder | P3–P4 |

## 4\. Plans and entitlements

From the notes. Prices are not final; billing is out of scope until after user testing.

| Plan | Price (notes) | Includes |
| :---- | :---- | :---- |
| Free | ₹0 | Paste JD → tailored CV; CV \+ JD saved together on download |
| Plus | ₹399 | ⚠ Q3: notes don't map features to Plus |
| Pro (trial) | ₹799 | Honne IQ: Drive \+ Notion connectors, stored past applications ("2 week" ⚠ Q4), specialised agents with weekly "what went wrong" analysis |
| Pro+ | ₹700/month (page 4\) | Pro \+ more specialised agents \+ **up to 10 custom agents** |

- Conflict: page 1 says Pro ₹799; page 4 says Pro+ ₹700/month. ⚠ Q3.  
- Beta: everything shipped is free, no card (landing \+ sign-in copy).  
- **Requirement now:** the backend carries a `plan` on the user and checks entitlements per feature, so pricing can be switched on later without touching feature code. No payment provider yet.

## 5\. Phases

| Phase | Scope | Done when |
| :---- | :---- | :---- |
| **P1 — CV studio (beta)** | Auth, profile, tailoring, chat edits, templates, PDF, analysis, save-on-download | §13 acceptance criteria pass |
| P2 — Honne IQ tracker | Application records, referral \+ remarks \+ outcome, CV versions, Drive/Notion | Tracker table in the UI is fed by real data |
| P3 — Built-in agents | CV Writer, Analyst, Advisor, Strategist; weekly report | A user gets a weekly report built from their own records |
| P4 — Custom agents | Builder, tools, preview-before-save, limit 10 | A user saves and runs their own agent |
| Later | Billing, more templates (Classic, Modern) | — |

Backend work starts at P1. P2–P4 are listed so P1 data shapes don't block them.

## 6\. Functional requirements

`MUST` \= required for the phase. `SHOULD` \= expected, can slip. IDs are stable; reference them in `Day_N.md`.

### 6.1 Auth and account (P1)

| ID | Requirement |
| :---- | :---- |
| AUTH-1 | MUST support Google SSO, Microsoft SSO, and email \+ password with password reset. |
| AUTH-2 | MUST scope every read and write by `user_id` (same tenant rule as Honne IQ). |
| AUTH-3 | MUST let a user delete their account and all their data (CVs contain personal data). |
| AUTH-4 | MUST record acceptance of Terms and Privacy Policy with a version and timestamp. |

### 6.2 Profile: the single source of truth (P1)

| ID | Requirement |
| :---- | :---- |
| PROF-1 | MUST hold one structured profile per user: personal details, experience\[\], projects\[\], education\[\], skills (languages, frameworks, cloud & tools). |
| PROF-2 | MUST create the profile from: PDF upload, DOCX upload, pasted LaTeX, or the from-scratch form. |
| PROF-3 | MUST store the original upload and show its name ("Profile: CV\_Arjun\_2026.pdf"); "Change" replaces the source. |
| PROF-4 | MUST let the user review and edit the parsed profile. A parsing mistake must not flow silently into every tailored CV. |
| PROF-5 | MUST fail loudly on unreadable input (image-only PDF, corrupt DOCX, LaTeX that can't be parsed) with a user-facing reason. No OCR unless approved in a plan. |
| PROF-6 | MUST accept rough notes in experience/project fields ("p95 latency down \~38%"); these are the raw facts bullets are built from. |
| PROF-7 | MUST support multiple entries per section ("+ Add another role / project / education"). |
| PROF-8 | SHOULD version the profile so a tailored CV can say which profile version it came from. |

### 6.3 Tailoring a CV to a JD (P1)

| ID | Requirement |
| :---- | :---- |
| TAIL-1 | MUST accept a pasted JD of up to 1,000 words; reject longer input with a clear message. |
| TAIL-2 | MUST block tailoring until a profile exists (UI shows a locked button). |
| TAIL-3 | MUST run as a job with 4 reported steps: reading the JD → matching experience → rewriting bullets → building the PDF. The UI polls or streams progress. |
| TAIL-4 | MUST write bullets as "Accomplished X, measured by Y, by doing Z", using only profile facts. If the profile has no metric, the bullet has no metric. |
| TAIL-5 | MUST put the experience most relevant to the JD first ("everything relevant, up top"). |
| TAIL-6 | MUST NOT add a JD skill the profile lacks; list it as missing instead (see TRUTH rules, §7). |
| TAIL-7 | MUST produce a versioned tailored CV (structured content \+ PDF), linked to its JD and profile version. "Tailor again" creates a new version. |
| TAIL-8 | SHOULD keep the CV to one page unless the user asks otherwise. |

### 6.4 Edit via chat (P1)

| ID | Requirement |
| :---- | :---- |
| CHAT-1 | MUST accept plain-language change requests on a tailored CV ("Lead with ownership", "Keep it to one page"). |
| CHAT-2 | MUST apply changes using only profile facts; refuse in the reply if a request needs invented content. |
| CHAT-3 | MUST produce a new CV version per applied change and keep the conversation per tailored CV. |
| CHAT-4 | SHOULD return the 4 suggestion chips from the UI; they may be static in P1. |

### 6.5 Templates and PDF (P1)

| ID | Requirement |
| :---- | :---- |
| PDF-1 | MUST render two templates: Jake's Resume and Elegant. Switching template does not re-run the LLM. |
| PDF-2 | MUST compile the PDF with LaTeX ("compiled with LaTeX so every ATS reads it cleanly"). |
| PDF-3 | MUST escape all user text before inserting it into a template. User-pasted LaTeX is **parsed for content only, never compiled**. No shell-escape. |
| PDF-4 | MUST produce text-selectable, single-column PDFs (ATS-safe). |

### 6.6 Analysis: how this CV fits the job (P1)

| ID | Requirement |
| :---- | :---- |
| ANA-1 | **Keyword match %**: JD skills/terms present in the CV, with matched and missing lists. Missing items say "not in your profile, so we didn't add it". |
| ANA-2 | **Experience match %**: per JD requirement, a level (Yes / Strong / Partial / None) and, where relevant, years ("4 yrs · needs 3+"). |
| ANA-3 | **JD–CV narrative alignment %**: the JD's story, the story of the CV's top third, and one concrete "Try:" suggestion. |
| ANA-4 | MUST return scores as JSON with the evidence behind each; the UI renders prose. |
| ANA-5 | MUST be reproducible enough to trust: same CV \+ JD → same score within a stated tolerance ⚠ Q7. |

### 6.7 Save on download (P1)

| ID | Requirement |
| :---- | :---- |
| SAVE-1 | On "Download PDF", MUST save the CV version and its JD together as an application record (the notes' "save both once you click download"). This is free-tier. |
| SAVE-2 | MUST extract company and role from the JD for the record; user can correct them. |
| SAVE-3 | MUST be idempotent: downloading the same CV version for the same JD twice does not create two records. |

### 6.8 Honne IQ tracker (P2)

| ID | Requirement |
| :---- | :---- |
| IQ-1 | MUST hold per application: date, company, role, JD, CV version used, referral (Yes / No / Asked / —), remarks. |
| IQ-2 | MUST hold an **outcome** (e.g. no reply, interview, rejected, offer). Not in the UI yet, but the Analyst can't say "what went wrong" without it. ⚠ Q5 |
| IQ-3 | MUST let users add applications made outside Honne (manual entry). |
| IQ-4 | MUST expose the tracker to agents through the same retrieval layer as Honne IQ knowledge. |

### 6.9 Connectors (P2)

| ID | Requirement |
| :---- | :---- |
| CON-1 | MUST support Google Drive and Notion, reusing the Honne IQ connector factory (Drive exists; Notion is a new registered class). |
| CON-2 | Direction is undecided: read (ingest the user's job-search docs) vs write (export tracker/CVs). ⚠ Q6 |

### 6.10 Built-in agents and weekly report (P3)

| Agent | Job |
| :---- | :---- |
| CV Writer | Tailors CVs (this is the P1 tailoring flow as an agent). |
| Analyst | Reads logged CVs, JDs and replies; says what's working and what isn't. |
| Advisor | Where to apply, who to ask for a referral, when to follow up; sure shots first. |
| Strategist | Plans next week from what went wrong this week. |

| ID | Requirement |
| :---- | :---- |
| AGT-1 | MUST produce a weekly report per user: summary, what's working, what's not, next week's plan. |
| AGT-2 | MUST answer the notes' three questions: are we applying blind; were past sure-shot applications high or low; an optimised plan. |
| AGT-3 | "Blind" and "sure shot" MUST be deterministic definitions over tracker data (landing copy implies blind \= no referral \+ weak fit). Thresholds ⚠ Q8. |
| AGT-4 | MUST run on a schedule with bounded retries and a run report (same pattern as the Honne IQ poller). |

### 6.11 Custom agents (P4, USP)

| ID | Requirement |
| :---- | :---- |
| CUST-1 | MUST let a user define an agent: handle (`@follow-up`), plain-language instructions, and allowed knowledge & tools. |
| CUST-2 | Tools in the UI: Honne IQ, Gmail, Google Calendar, "LinkedIn notes" ⚠ Q9. |
| CUST-3 | MUST offer "try it before you save" (preview run, nothing persisted). |
| CUST-4 | MUST cap custom agents per user (10 on Pro+). |
| CUST-5 | Gmail MUST be **draft-only**: agents create drafts, never send. Calendar scope ⚠ Q9. |
| CUST-6 | MUST treat JDs, emails and docs as untrusted input (prompt injection). An agent can only call tools the user granted it. |
| CUST-7 | Reuse the existing custom-agent backend if it already does this ⚠ Q1. |

### 6.12 Plans and quotas (P1 data, enforced later)

| ID | Requirement |
| :---- | :---- |
| PLAN-1 | MUST store `plan` per user and gate features through one entitlement check. |
| PLAN-2 | MUST apply per-user rate limits on LLM-backed actions (tailor, chat edit, analysis) even in the free beta, configured not hardcoded. Limits ⚠ Q10. |

### 6.13 Beta feedback (P1, SHOULD)

| ID | Requirement |
| :---- | :---- |
| FB-1 | SHOULD capture beta sign-ups and free-text "how you search" feedback, so founders can learn from it. |

## 7\. Truthfulness rules (the product promise)

| ID | Rule |
| :---- | :---- |
| TRUTH-1 | Every skill, employer, title, date, metric and project in a generated CV MUST trace to a profile field. |
| TRUTH-2 | This is checked **deterministically after generation** (skills, numbers, employers, dates matched against the profile), not left to the prompt. |
| TRUTH-3 | On a violation the CV is not shown as ready. Whether to regenerate once or fail is a fallback ⚠ Q11 (guardrails §3: no silent fallback). |
| TRUTH-4 | Rewording is allowed; new facts are not. "Mentored 2 interns" may become "Mentored two interns to their first launch" only if "first launch" is in the profile. |

## 8\. LLM vs deterministic Python

Per CLAUDE.md: LLM for judgment, Python for mechanics; JSON between machines.

| Task | Owner |
| :---- | :---- |
| Parse PDF/DOCX/LaTeX to text | Python |
| Text → structured profile | LLM (JSON schema), validated by Python |
| Extract JD requirements, skills, company, role | LLM (JSON) |
| Keyword match % | Python over LLM-extracted skill lists |
| Years of experience | Python from profile dates |
| Requirement levels (Strong / Partial / None) | LLM (JSON, with evidence) |
| Bullet rewriting, ordering for relevance | LLM |
| Truthfulness check (TRUTH-2) | Python |
| Narrative alignment score \+ suggestion | LLM (rubric, JSON) |
| Template rendering, escaping, LaTeX compile | Python |
| Blind / sure-shot classification | Python |
| Weekly report narrative | LLM over Python-computed stats |

## 9\. Non-functional requirements

| Area | Requirement |
| :---- | :---- |
| Stack | Reuse the Honne IQ backend stack and conventions as in CLAUDE.md (assumed: FastAPI, Postgres \+ pgvector, Gemini, Render, GitHub Actions) ⚠ Q1. |
| Latency | Tailoring end to end within the UI's promise (\~15 s rewrite \+ \~20 s PDF); progress visible the whole time. Target set in the LLD with real measurements. |
| Cost | Every LLM-backed operation gets a time/space/calls/cost row (guardrails §5). Template switch and re-download cost 0 LLM calls. |
| Privacy | CVs are personal data. Users in India (DPDP Act) and the EU (GDPR). Encrypt connector tokens (as Honne IQ does). Retention and deletion rules ⚠ Q4. No CV/JD content in logs (guardrails §4). |
| Security | PDF-3 (LaTeX), CUST-5/6 (agents), upload size and type limits, signed download URLs. |
| Observability | Structured logs with correlation id per tailoring job / agent run, `user_id`, entity id (guardrails §4). |
| Reliability | Tailoring job state survives a restart or is marked failed; never stuck "generating". |
| Testing | Unit \+ integration in CI, no real Gemini/Google calls in tests (Honne IQ pattern). Golden tests for the truthfulness checker. |

## 10\. Out of scope (now)

- Payments and billing (after user testing).  
- Classic and Modern templates ("coming soon").  
- Auto-applying to jobs or sending email on the user's behalf.  
- OCR of scanned CVs.  
- Per-ATS behaviour beyond ATS-safe output (see claim C3).

## 11\. Claims register

Product copy the backend or data must back up (guardrails §7: no invented facts).

| \# | Claim (where) | What backs it | Status |
| :---- | :---- | :---- | :---- |
| C1 | "Built from 5,000+ real applications" (landing) | Founders' and friends' applications | Stated by founder; keep the dataset documented |
| C2 | Agents trained on advice from 100+ tech career advisers, \~1 year of learning (notes) | Named creators in founder notes | ⚠ Q12: how it's used, attribution/permission before any public claim |
| C3 | "Tuned" for 12 named ATSs (landing) | — | ⚠ Q13: define "tuned" and how it's tested, or soften the copy |
| C4 | "Nothing invented" (everywhere) | TRUTH-1…4 | Enforced by §7 |

## 12\. Open questions (decide before the related LLD)

| \# | Question | Blocks |
| :---- | :---- | :---- |
| Q1 | Does Honne Careers live in the existing Honne IQ repo and reuse its CLAUDE.md, auth, connectors and custom-agent backend? | Everything |
| Q2 | Auth provider: the existing JWT setup, Supabase Auth, or another? Microsoft SSO is new. | AUTH-1 |
| Q3 | Plan names, prices and which features sit in Plus vs Pro vs Pro+ (₹799 vs ₹700 conflict). | PLAN-1 |
| Q4 | "Stores past applications for 2 weeks": trial length, or retention limit? What happens to data when a trial ends? | IQ, privacy |
| Q5 | Add an outcome field to the tracker? Which values? | IQ-2, AGT-2 |
| Q6 | Drive/Notion: ingest the user's docs, export the tracker/CVs, or both? | CON-2 |
| Q7 | Acceptable score variance for the three analysis scores. | ANA-5 |
| Q8 | Thresholds for "weak fit", "blind" and "sure shot". | AGT-3 |
| Q9 | What is the "LinkedIn notes" tool? Calendar: read-only or create events? | CUST-2, CUST-5 |
| Q10 | Beta rate limits per user per day (tailors, chat edits). | PLAN-2 |
| Q11 | On a truthfulness violation: regenerate once, or fail to the user? | TRUTH-3 |
| Q12 | Use of named advisers' public content: permission and attribution. | C2 |
| Q13 | Meaning of "tuned" per ATS. | C3 |
| Q14 | LaTeX engine on the host (e.g. Tectonic vs TeX Live): image size and cold start on Render. | PDF-2 |

## 13\. P1 acceptance criteria (beta ready)

1. A new user signs in with Google, Microsoft or email.  
2. They create a profile by PDF, DOCX, LaTeX paste or the form, and can edit it.  
3. They paste a JD (≤ 1,000 words), tailor, and see 4 progress steps then a preview.  
4. The CV contains nothing that fails the truthfulness check; missing JD skills are listed, not added.  
5. They switch between Jake's Resume and Elegant without a new LLM call.  
6. They request a change in chat and get a new version.  
7. They see keyword, experience and narrative scores with evidence.  
8. Download produces an ATS-safe PDF and one application record (CV version \+ JD).  
9. Every failure above is logged with a correlation id and shown to the user with a reason.  
10. Deleting the account removes the profile, uploads, CVs, JDs and records.