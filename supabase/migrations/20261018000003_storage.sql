-- Private bucket for CV files (Day_1 B1). Paths:
--   {user_id}/uploads/{upload_id}.{ext}
--   {user_id}/resumes/{resume_id}/{content_hash}.pdf
-- Policy: the first folder must be the caller's own id. Paths are built server-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-files', 'cv-files', false, 5242880,
        array['application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy cv_files_select on storage.objects for select to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cv_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-files'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cv_files_update on storage.objects for update to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cv-files'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cv_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
