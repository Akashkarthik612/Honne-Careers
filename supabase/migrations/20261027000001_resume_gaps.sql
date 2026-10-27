-- CV Tailor V4.1: JD requirements that are not technical skills (TAIL-6).
--  * resumes.jd_gaps: the last full tailor's gaps, [{kind, text}] where kind is
--    qualification / experience / language. Kept apart from missing_skills because the user
--    can't confirm "5+ years" or "B.Tech" with one click the way they confirm a skill.
--    Written only by the tailor job, shown read-only on the CV page. Table-level grants on
--    app.resumes (20261018000002) already cover the new column.

alter table app.resumes
  add column jd_gaps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(jd_gaps) = 'array' and pg_column_size(jd_gaps) <= 16384);
