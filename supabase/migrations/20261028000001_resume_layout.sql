-- Templates and layout (PDF-1): a second template, a user-chosen section order, and a PDF
-- cache keyed on everything that changes the PDF.
--  * template: the app's TemplateRegistry is the one list of templates, so the column only
--    checks the id's shape. A new template is a code change, not a migration.
--  * section_order: null = the template's default order; otherwise every section key once,
--    validated by the API (app/domain/layout.py).
--  * pdf_content_hash -> pdf_render_key: sha256 of (content_hash, template, template
--    revision, section order). A PDF is reused only when all four match, so switching
--    template or order never serves an old PDF. Existing PDFs rebuild once on next download.
-- Table-level grants on app.resumes (20261018000002) already cover the new column.

alter table app.resumes drop constraint resumes_template_check;
alter table app.resumes
  add constraint resumes_template_check check (template ~ '^[a-z][a-z0-9_]{0,39}$');

alter table app.resumes
  add column section_order text[]
    check (section_order is null or cardinality(section_order) between 1 and 12);

alter table app.resumes rename column pdf_content_hash to pdf_render_key;
