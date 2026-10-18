# Day 1: Feature 1 backend (paste JD → wizard → preview → PDF)

Read before coding: [CLAUDE.md](./CLAUDE.md), [project\_requirements.md](./project_requirements.md), [guardrails.md](./guardrails.md). **Status:** LLD v3 approved 18 Oct 2026 (B11 all as proposed). Built on `feature/backend-p1`; see Part C for the summary and deviations. **Supersedes** in project\_requirements.md: §6.4 (chat edits, removed) and the §6.3 flow (now wizard-based). Rules there still apply.

---

# Part A: Context

## A1. Stack and deployment (decided)

| Layer | Choice | Tier |
| :---- | :---- | :---- |
| Database | Supabase Postgres, **RLS on every table** | Free |
| Auth | Supabase Auth, **Google \+ GitHub only** (no email/password) | Free |
| Files | Supabase Storage, private bucket, per-user folders | Free |
| Backend | Python + FastAPI on Render (Docker image with Tectonic inside) | Paid: Starter ~$7 (512 MB), Standard ~$25 (2 GB) if LaTeX needs it |
| Frontend | Render Static Site (no Vercel) | Free |
| LLM | Gemini now; Claude or OpenAI once there are paying customers | Free tier |

Supabase free plan (checked 18 Oct 2026): 500 MB DB, 1 GB storage, 50k MAU, social OAuth included, RLS available, **paused after 1 week idle, no automatic backups**.

## A2. Decisions (founder notes \+ 18 Oct discussion)

| \# | Decision |
| :---- | :---- |
| 1 | Multi-tenant, highly secured (many people's CVs): Postgres RLS enforced by the DB, not only app code. |
| 2 | **Agents are config** (as in Honne AI and Dust): one config per task, sent to an API call when needed. One agent per click, no multi-agent orchestration. |
| 3 | Tailoring → strong model. Analysis and parsing → light model. Models are config. |
| 4 | System prompt for tailoring \= the `cv-jd-tailoring` skill, adapted (B4). |
| 5 | **Flow (resumax-style):** dashboard → template → mode → paste JD → wizard cards → preview → LaTeX PDF. |
| 6 | **Returning users** (saved profile) skip the wizard: paste JD → tailored CV straight into preview, with Edit and Download. |
| 7 | **No chat.** Users edit in the wizard cards. |
| 8 | **User edits are always kept, as typed** (B5). |
| 9 | Live preview while editing is client-side; LaTeX compiles only on Preview/Download. |
| 10 | Beta: Jake template only. "Tailor to a JD" is a paid feature later, free during beta behind a config switch. |
| 11 | Included, removable: CV upload to pre-fill, "Also save to my profile" on finish, Analysis on the preview page. |

## A3. User flows

| Step | First-time user | Returning user |
| :---- | :---- | :---- |
| 1 | Dashboard (empty) → New resume | Dashboard → New resume |
| 2 | Pick template (Jake) | Same |
| 3 | Mode: Tailor to JD / Build from scratch | Same |
| 4 | Paste JD (optional: upload CV to pre-fill) | Paste JD → **Tailor my CV** (one AI call) |
| 5 | Wizard: Personal → Experience → Projects → Education → Skills, per-bullet "Tailor to JD", skill suggestions | Skipped (Edit reopens it pre-filled) |
| 6 | Preview → Download PDF | Preview → Download PDF |
| 7 | Optional: Start analysis; "Also save to my profile" | Same |

## A4. Done when

1. Google/GitHub tokens accepted; anonymous, expired or forged → 401\.  
2. Dashboard lists, opens, duplicates and deletes a user's resumes (delete removes storage files too).  
3. A first-time user completes the wizard; every step autosaves; a stale save from a second tab gets 409\.  
4. Per-bullet tailoring returns a tailored bullet with Keep/Revert; a user-edited bullet is never changed by AI.  
5. A returning user's "Tailor my CV" produces a full resume from the profile \+ JD; nothing fails the truth check; missing JD skills come back as suggestions only.  
6. Download compiles a one-page ATS-safe PDF with LaTeX; unchanged content reuses the stored PDF.  
7. Analysis returns 3 scores; same content again \= stored result, 0 LLM calls.  
8. **RLS test:** as user B, unfiltered queries return 0 of user A's rows in every table and in storage.  
9. Every agent run recorded (agent, version, model, tokens, latency); no CV/JD text in logs.  
10. CI green with no real Gemini/Supabase calls; live on Render.

---

# Part B: LLD

## B1. Data model

erDiagram

  USER\_ACCOUNTS ||--o| PERSONAL\_PROFILES : has

  USER\_ACCOUNTS ||--o{ RESUMES : owns

  USER\_ACCOUNTS ||--o{ CV\_UPLOADS : uploads

  JOB\_DESCRIPTIONS ||--o{ RESUMES : "tailored to"

  RESUMES ||--o{ CV\_ANALYSES : "scored (per content hash)"

  USER\_ACCOUNTS ||--o{ AGENT\_RUNS : triggers

| Table | Key columns | Notes |
| :---- | :---- | :---- |
| `user_accounts` | `user_id` PK → `auth.users`, `plan`, `terms_version`, `terms_accepted_at` | Created on first request |
| `personal_profiles` | `user_id` PK, `content jsonb` (CvContent), `row_version` | Saved profile; returning users tailor from it |
| `cv_uploads` | `id`, `user_id`, `source_type` (pdf/docx/latex), `filename`, `storage_path`, `parsed jsonb` | Pre-fill source only |
| `job_descriptions` | `id`, `user_id`, `text`, `word_count`, `content_hash`, `company`, `role` | Unique (`user_id`, `content_hash`) |
| `resumes` | `id`, `user_id`, `title`, `template`, `mode` (tailored/scratch), `jd_id`, `content jsonb` (CvContent), `missing_skills jsonb`, `wizard_step`, `status` (draft/tailoring/ready/failed), `row_version`, `content_hash`, `pdf_path`, `pdf_content_hash`, `page_count`, `error_code`, `updated_at` | One per dashboard card |
| `cv_analyses` | `id`, `user_id`, `resume_id`, `content_hash`, 3 scores, `details jsonb`, `agent_run_id` | Unique (`resume_id`, `content_hash`) \= cache |
| `agent_runs` | `id`, `user_id`, `agent_id`, `agent_version`, `provider`, `model`, `status`, tokens, `latency_ms`, `error_code` | No prompt or content stored |

Rules: every table has `user_id` \+ index; composite FKs `(user_id, x_id)`; cascade on user delete; RLS enabled **and forced**, policy `user_id = (select auth.uid())`; tables in a non-exposed `app` schema. Storage bucket `cv-files`: `{user_id}/uploads/{id}.{ext}`, `{user_id}/resumes/{resume_id}/{content_hash}.pdf`; policy: first folder \= `auth.uid()`.

## B2. Data classes (Pydantic)

| Class | Fields | Invariant |
| :---- | :---- | :---- |
| `CvContent` | `header` (name, location, email, phone, links\[\]), `experience[]`, `projects[]`, `education[]`, `skills` (languages\[\], frameworks\[\], tools\[\]) | One shape for profile, resume, upload pre-fill and AI output; renderer's only input |
| `Bullet` | `id`, `text`, `origin` (user/profile/import/ai), `locked: bool`, `original_text`, `tailor_state` (none/proposed/kept) | `locked` ⇒ AI never writes it |
| `SkillItem` | `name`, `origin` | — |
| `ExperienceItem` / `ProjectItem` / `EducationItem` | role, company, location, start, end, `bullets[]` / name, tech\[\], date, `bullets[]` / school, degree, years, location | `company`, `start` required |
| `ResumePatch` | `section`, `value`, `expected_version` | Autosave unit (one wizard step) |
| `TailorInput` | `content: CvContent` (locked bullets marked), `jd_text`, `scope` (all / experience+projects) | — |
| `TailorOutput` | `content: CvContent`, `changes: list[CvChange]`, `missing_skills: list[str]` | `cv_tailor` output schema |
| `BulletTailorInput` / `BulletTailorOutput` | bullet text \+ its role/project \+ `jd_text` / `text` | `bullet_tailor` schemas |
| `CvChange` | `field_path`, `before`, `after` | Feeds "What changed" |
| `FactSet` | normalised skills, employers, schools, degrees, dates, numbers | Built from user-owned content (B5) |
| `TruthReport` | `passed`, `violations[]` (field\_path, value, rule) | Deterministic |
| `AnalysisJudgment` | `jd_skills[]`, `requirements[]` (text, level, evidence), `min_years`, `narrative` (sub-scores 0–5, jd\_story, cv\_story, suggestion) | `cv_analyst` output; no percentages |
| `CvScores` | `keyword`, `experience`, `narrative` (0–100), `details` | Computed in Python |
| `AgentRunRecord` | as `agent_runs` | Written for every call |

## B3. Agents as config (Dust-style)

An agent is **data, not a class**. One runner executes any agent.

\# agents/cv\_tailor.yaml

id: cv\_tailor

version: 1

description: Tailors a CV to a JD without inventing anything

model\_tier: strong                      \# tier → model from env

temperature: 0.2

max\_output\_tokens: 8192

instructions: prompts/cv\_tailor/v1.md   \# cv-jd-tailoring skill, adapted

input\_schema: TailorInput

output\_schema: TailorOutput

tools: \[\]

timeout\_s: 60

max\_retries: 2

| Agent | Tier | Triggered by | Output |
| :---- | :---- | :---- | :---- |
| `cv_parser` | light | Upload CV / paste LaTeX | `CvContent` |
| `cv_tailor` | strong | "Tailor my CV" (returning user), "Tailor all bullets" | `TailorOutput` |
| `bullet_tailor` | strong | "Tailor to JD" on one bullet | `BulletTailorOutput` |
| `cv_analyst` | light | "Start analysis" | `AnalysisJudgment` |

Env: `LLM_STRONG=gemini:<model id>`, `LLM_LIGHT=gemini:<model id>`. Switching to Claude \= one new provider adapter \+ env change; agent files unchanged.

| Class | Role | Pattern |
| :---- | :---- | :---- |
| `AgentConfig` | The YAML, validated at startup | Data |
| `AgentRegistry` | Loads `agents/*.yaml`; startup fails on bad config or missing prompt file. Custom agents (P4) add a DB source, same shape | Registry |
| `ModelResolver` | tier → `ModelSpec(provider, model_id)` | Config map |
| `LlmProvider` (Protocol) | `generate(system, user_json, schema, model, temp, max_tokens) → LlmResult` | Adapter: `GeminiProvider`, `FakeProvider` (tests) |
| `ProviderFactory` | dict `provider → LlmProvider` | Factory |
| `AgentRunner` | validate input → build prompt → call with retries → validate output → record run | Service |

Prompt: system \= instructions file. User message \= input JSON, JD and CV wrapped as **untrusted data**. Output forced by `response_json_schema`, then Pydantic.

## B4. System prompt \= `cv-jd-tailoring` skill, adapted

| Skill rule | In the product |
| :---- | :---- |
| Never fabricate | Kept; enforced again by `TruthChecker` |
| Preserve length (same bullets per role, same items per skill category) | Kept; checked in Python |
| Ask before adding a JD skill the CV lacks | → `missing_skills[]`, shown as suggestion chips in the Skills card; added only when the user clicks "+" |
| Reword titles/bullets in JD terms if the fact holds | Kept; bullets as "Accomplished X, measured by Y, by doing Z" |
| Make only the requested change | Per-bullet tailor touches one bullet; locked bullets are never sent as editable |
| Summarise every change before → after | `changes[]` → "What changed" panel and Keep/Revert per bullet |
| Preserve source format | N/A: AI returns JSON, Python renders LaTeX |

Files: `prompts/cv_tailor/v1.md`, `prompts/bullet_tailor/v1.md` (same rules, one bullet). Akash reviews the adapted text before merge.

## B5. User-edit rule (decided)

| Rule | How |
| :---- | :---- |
| Anything the user types is saved and printed **exactly as written**, never blocked or rewritten | Autosave stores it; `origin=user`, `locked=true` for bullets |
| User content counts as fact | `FactSet` \= profile \+ upload \+ every `origin=user` value in this resume |
| AI never overwrites a user edit | Server merges AI output and **drops changes to locked fields**, regardless of what the model returned |
| A user-edited bullet changes only if the user clicks Tailor on it | That call unlocks just that bullet |
| Only safety processing on user text | LaTeX escaping at render, length caps per field |

`TruthChecker` runs on **AI output only**: every skill, employer, school, degree, date and number must exist in `FactSet` (with a skill alias dict); bullet and skill counts match the input.

## B6. Flows

flowchart LR

  N\[New resume: template \+ mode\] \--\> J\[Paste JD\]

  J \--\>|first-time| W\[Wizard cards, autosave\]

  J \--\>|returning: Tailor my CV| T\[cv\_tailor job → truth check → merge\]

  W \--\>|Tailor to JD on a bullet| B\[bullet\_tailor → truth check → proposed\]

  B \--\>|Keep / Revert| W

  T \--\> P\[Preview: client-side render\]

  W \--\> P

  P \--\>|Edit| W

  P \--\>|Download| R\[LaTeX render → compile → PDF\]

  P \--\>|Start analysis| A\[cv\_analyst → scores, cached by content hash\]

| Flow | Server steps |
| :---- | :---- |
| Autosave | `PATCH` with `expected_version` → 409 if stale → store → `row_version++`, new `content_hash` |
| Bullet tailor (sync, ≤ timeout) | Load bullet \+ role \+ JD → `bullet_tailor` → TruthChecker → store as `proposed` with `original_text` |
| Keep / Revert | Keep → `kept`. Revert → `text = original_text`, `none` |
| Tailor my CV / Tailor all (job, 202\) | `status=tailoring` → `cv_tailor` on profile/resume content (locked marked) → TruthChecker → **merge** (locked untouched) → `ready`; frontend polls |
| PDF | If `pdf_content_hash == content_hash` → reuse. Else `LatexRenderer` (escaped, fixed Jake template) → `LatexCompiler` (temp dir, no shell-escape, timeout) → page count → store → signed URL |
| Save to profile | Copy resume content into `personal_profiles` (`expected_version`) |
| Analysis | Cache hit on (`resume_id`, `content_hash`) → return. Else `cv_analyst` → `ScoreCalculator` → store |

**The model never writes LaTeX.** It returns JSON; Python fills a fixed template. Safe compile, and preview content always equals PDF content.

## B7. Other classes

| Class | Role | Pattern / structure |
| :---- | :---- | :---- |
| `JwtVerifier` | Supabase JWT: signature (JWKS), `exp`, `aud`, `iss`; rejects `anon` | JWKS dict by `kid`, TTL cache |
| `get_current_user` | FastAPI dependency → `AuthUser` | DI |
| `UserScopedSession` | One transaction per request: `SET LOCAL role` \+ JWT claims, so RLS applies to backend queries | Unit of Work |
| `*Repository` (profiles, uploads, JDs, resumes, analyses, agent runs) | Only code with SQL; also filters by `user_id` | Repository |
| `ResumeMerger` | Applies AI output to content, skipping locked fields; records `changes` | Pure function |
| `TruthChecker` | B5 | Pure; hash sets |
| `TemplateRegistry` | `jake` only; `GET /templates` | dict |
| `LatexRenderer` / `LatexCompiler` / `PdfInspector` | Render, compile, page count | Strategy per template |
| `TextExtractor` \+ Pdf/Docx/Latex | Magic bytes, size/page caps; LaTeX read as text, never compiled | Strategy via dict |
| `CvFileStore` | Supabase Storage with the user's token; signed URLs | Adapter |
| `ScoreCalculator` | Keyword % \= JD skills found ÷ JD skills; Experience % \= mean level weight (yes/strong 1, partial 0.5, none 0\) \+ years from dates; Narrative % \= mean sub-score × 20 | Pure |
| `Entitlements` | `can(user, "tailor_mode")`; `BETA_FREE_TAILORING=true` | Config |
| `QuotaGuard` | Daily limits per action from env | Count query |

## B8. API

| Method | Path | Does |
| :---- | :---- | :---- |
| GET | `/health` | No auth |
| GET | `/me` | User, plan, `has_profile` |
| GET | `/templates` | `[jake]` |
| GET / PUT | `/profile` | Read / save the profile (`expected_version`) |
| POST | `/uploads`, `/uploads/latex` | → `cv_parser` → `CvContent` pre-fill |
| GET / POST | `/resumes` | Dashboard list / create `{template, mode, title?}` |
| GET / PATCH / DELETE | `/resumes/{id}` | Open / autosave a section / delete (+ files) |
| POST | `/resumes/{id}/duplicate` | Copy |
| PUT | `/resumes/{id}/jd` | Set JD (1–1,000 words), detect company \+ role |
| POST | `/resumes/{id}/tailor` | 202, full tailor (`scope`) |
| POST | `/resumes/{id}/bullets/{bullet_id}/tailor` | One bullet → `proposed` |
| POST | `/resumes/{id}/bullets/{bullet_id}/keep`, `/revert` | Keep / revert |
| POST | `/resumes/{id}/pdf` | Build or reuse → signed URL |
| POST | `/resumes/{id}/save-to-profile` | Copy to profile |
| POST | `/resumes/{id}/analysis` | Run or return cached |

## B9. Fallbacks (none silent)

| Trigger | Behaviour | User sees |
| :---- | :---- | :---- |
| Gemini 429 / 5xx / timeout | Retry `max_retries`, backoff | "Couldn't reach the AI, try again"; content unchanged |
| Output fails schema | Fail, no retry | Same; content unchanged |
| Truth violation, one bullet | That suggestion rejected; bullet unchanged | "We couldn't tailor this without adding things you didn't write" |
| Truth violation, full tailor | **Proposed:** violating items keep their original text; the rest applied; violations listed | Same message \+ affected fields |
| Stale autosave | 409, nothing written | "Updated in another tab, reload" |
| LaTeX compile error | Fail (`render_failed`) \= template/escaping bug | "Couldn't build the PDF. Your edits are saved." |
| PDF over 1 page | Built, with `page_count` warning | "Your CV runs to 2 pages" |
| Tailor job past timeout (Render sleep/restart) | `failed` (`stale_job`) on next read | "This took too long, try again" |
| Tailor mode without entitlement (after beta) | 402 | Upgrade prompt |

## B10. Cost per action

| Action | LLM calls | Model | Other |
| :---- | :---- | :---- | :---- |
| Wizard edit, autosave, live preview, Keep/Revert | 0 | — | 1 DB write (autosave) |
| Bullet tailor | 1 (small input) | strong | — |
| Tailor my CV / Tailor all | 1 | strong | — |
| Upload pre-fill | 1 | light | 1 storage write |
| Download PDF | 0 | — | 1 LaTeX compile per content change; 0 if unchanged |
| Analysis | 1 per content version | light | — |

Main cost risk: many per-bullet tailors → daily quota.

## B11. Decisions for Akash

| \# | Decision | Proposed |
| :---- | :---- | :---- |
| 1 | AI returns JSON; Python renders LaTeX | Yes |
| 2 | Agent configs as YAML in the repo; custom agents (P4) in the DB, same shape | Yes |
| 3 | `bullet_tailor` on the strong tier | Yes |
| 4 | Full-tailor truth violation: keep originals for violating items, apply the rest, show them | Yes |
| 5 | Bullet tailor sync (≤ 30 s); full tailor as a job \+ polling | Yes |
| 6 | LaTeX engine: Tectonic in the Docker image, packages cached at build | Yes; check memory on Render free |
| 7 | Retries on 429/5xx/timeout | 2 |
| 8 | Daily quotas (env) | 20 full tailors, 150 bullet tailors, 40 PDFs, 40 analyses |
| 9 | Upload caps | 5 MB, 4 pages |
| 10 | Wizard has 5 steps (Education added) | Yes |

## B12. Second-brain check

1. **Gemini free tier \+ real CVs:** check Google's terms on use of free-tier inputs before beta users upload.  
2. **No automatic backups** on Supabase free: plan one before real users.  
3. **Project pauses after 1 week idle.**  
4. **Storage files don't cascade:** delete them explicitly on resume and account deletion.  
5. **Client preview vs PDF:** the web preview must follow the LaTeX template's layout, or users see a different page than they download. The Preview page should show the compiled PDF.  
6. **CI** needs a stub `auth` schema (`auth.uid()`) for RLS tests.

## B13. Order of work after approval

0. CLAUDE.md → approve.  
1. Scaffold, config (fails on missing env), structured logging.  
2. Migrations \+ RLS \+ storage policies, **RLS tests first**.  
3. Auth \+ `UserScopedSession` \+ `/me`.  
4. Agent layer: config, registry, resolver, Gemini provider, runner, `agent_runs`.  
5. Profile \+ resumes CRUD \+ autosave (409) \+ dashboard \+ templates.  
6. `TruthChecker` \+ `ResumeMerger` (golden tests), then `bullet_tailor` and `cv_tailor`.  
7. LaTeX render/compile \+ PDF endpoint \+ Dockerfile.  
8. Uploads \+ `cv_parser`; analysis \+ `ScoreCalculator`; save to profile.  
9. Entitlements, quotas, CI, Render deploy.  
10. End-of-day summary for Day 2\.
---

# Part C: Day 1 summary (18 Oct 2026)

## C1. Done (A4)

| # | Criterion | Evidence |
| :---- | :---- | :---- |
| 1 | Tokens: valid accepted; anon / expired / forged / HS256 → 401 | `tests/unit/test_jwt_verifier.py` |
| 2 | Dashboard list/open/duplicate/delete; delete removes files | `test_resume_api.py` |
| 3 | Wizard autosave; stale second tab → 409 | `test_resume_api.py` |
| 4 | Bullet tailor + Keep/Revert; user-edited bullet never changed by AI | `test_tailoring_api.py`, golden tests |
| 5 | Returning user "Tailor my CV": truth check, missing skills as suggestions | `test_tailoring_api.py` |
| 6 | LaTeX PDF, one page; unchanged content reuses stored PDF | `test_pdf_api.py`; real Tectonic compile verified locally (1.9 s cached, offline) |
| 7 | Analysis: 3 scores; same content = cached, 0 LLM calls | `test_upload_analysis_api.py` |
| 8 | RLS: user B sees 0 of A's rows in every table and storage | `test_rls.py` (25 tests, real Postgres 16) |
| 9 | Every agent run recorded; no CV/JD text in logs | `test_logging_privacy.py` |
| 10 | CI with no real Gemini/Supabase; live on Render | CI written (`.github/workflows/backend.yml`); **deploy pending** (needs Supabase project + Render secrets) |

117 tests; ruff, bandit and pip-audit clean.

## C2. Deviations from B1–B11 (please confirm)

| Change | Why |
| :---- | :---- |
| `usage_events` table | PDF quota (B11 #8) had no row to count; one table now backs all quotas |
| `cv_analyses.jd_content_hash` in the cache key | Cache must miss when the JD changes, not only the CV |
| `resumes.job_started_at`, `resumes.tailor_report` | Stale-job detection (B9); "affected fields" after a full tailor (B9), paths only, no text |
| `DELETE /me` added | AUTH-3 (MUST) |
| AI may change bullet text and the order of experience, bullets and skills only; **titles stay as written** | Narrower than B4 "reword titles": safer for TRUTH-1 |
| Upload pre-fill stored as a lenient shape (`PrefillCv`) | Parsed CVs can lack company/start; the wizard applies strict rules (PROF-4) |
| Company/role from the JD: deterministic first-line heuristic, company left blank | No LLM call budgeted for it (B10); user corrects later (SAVE-2) |
| Bounded PDF queue: 1 compile, 5 waiting, 30 s | Plan v4 §1.5b; beyond → 503 "busy" |
| Jake template: pdfTeX-only `glyphtounicode` lines removed | Tectonic is XeTeX-based and emits Unicode text natively (ATS-readable) |

## C3. Day 2 inputs

1. Create the Supabase project (backend/README.md steps), fill Render secrets, deploy the Blueprint, run CI's docker job and record `tectonic_peak_rss_mb` → Starter or Standard.
2. Review the four prompts in `backend/prompts/` (B4) and the Gemini model ids in `render.yaml`.
3. Wire the frontend to the API (`VITE_API_BASE_URL`, Supabase Auth client, polling for the tailor job).
4. Still open: AUTH-4 terms acceptance, SAVE-1 application record, Supabase backups (B12 #2), Gemini free-tier data terms (B12 #1).
