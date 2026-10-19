# Honne Careers API

FastAPI + Tectonic (LaTeX) in one Docker image, on Render. Supabase for Postgres (RLS), Auth and Storage. Design: [Day_1.md](../Day_1.md). Rules: [CLAUDE.md](../CLAUDE.md).

## One-time Supabase setup

1. **Region**: Singapore (`ap-southeast-1`), the same region as the Render API. Render has no Mumbai region, and the API makes several DB round trips per request, so the DB must sit next to it.
2. **JWT signing keys**: Project Settings → JWT → switch to **asymmetric signing keys** (ES256/RS256). The API rejects HS256 tokens on purpose; with legacy secrets, every request fails with `auth_unavailable`.
3. **Auth providers** (beta: Google only; GitHub comes later): Authentication → Sign In / Providers → enable **Google** with a Google Cloud OAuth client (Web application; authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`). Disable Email and anonymous sign-ins.
   **URL configuration**: Site URL `https://honne-careers.onrender.com`; redirect URLs `https://honne-careers.onrender.com/auth/callback` and `http://localhost:5173/auth/callback`. A redirect not on this list silently lands on the Site URL instead.
4. **Migrations**: apply `supabase/migrations/*.sql` in order (`supabase db push`, or paste them into the SQL editor).
5. **Backend role password** (never in a migration):
   ```sql
   alter role honne_backend password '<long random>';
   ```
6. **Connection string**: use the **session pooler** (IPv4; Render has no IPv6 route to the direct host), with user `honne_backend.<project-ref>`.
7. **Exposed schemas**: leave `app` out of the Data API's exposed schemas (the default).

## Local development

```
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
PDF builds need `tectonic` on `PATH` (or `TECTONIC_BIN`). The first compile downloads LaTeX packages; after that it works offline.

## Tests

```
pytest -q
```
- Unit and golden tests always run.
- DB tests (RLS, API) need `DATABASE_URL_TEST` = superuser URL of a throwaway Postgres 16. Each run creates and drops its own database. Without it they're skipped locally and **fail** in CI. With no Docker, `pip install pgserver` gives an embedded Postgres.
- The real LaTeX test runs when `tectonic` is installed; CI also compiles inside the image with networking off.

## Deploy

`render.yaml` at the repo root is a Render Blueprint. Fill the `honne-careers-api-secrets` env group in the dashboard. `main` auto-deploys; `/health` is the health check. Check `tectonic_peak_rss_mb` in the CI docker job: Starter has 512 MB, Standard 2 GB.

## API (Day_1 B8)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | No auth |
| GET / DELETE | `/me` | DELETE = account + all data (AUTH-3) |
| GET | `/templates` | `[jake]` |
| GET / PUT | `/profile` | PUT with `expected_version` (omit to create) |
| POST | `/uploads`, `/uploads/latex` | → pre-fill for the wizard |
| GET / POST | `/resumes` | Dashboard / create |
| GET / PATCH / DELETE | `/resumes/{id}` | PATCH = autosave one section, 409 if stale |
| POST | `/resumes/{id}/duplicate` | |
| PUT | `/resumes/{id}/jd` | 1–1,000 words |
| POST | `/resumes/{id}/tailor` | 202; poll `GET /resumes/{id}` until `status` is `ready`/`failed` |
| POST | `/resumes/{id}/bullets/{bid}/tailor` · `/keep` · `/revert` | |
| POST | `/resumes/{id}/pdf` | Build or reuse → 5-minute signed URL |
| POST | `/resumes/{id}/analysis` | Cached per content + JD |
| POST | `/resumes/{id}/save-to-profile` | |

Errors: `{"error": {"code", "message", "correlation_id", "details?"}}`. Send `X-Correlation-Id` to trace a request across logs.
