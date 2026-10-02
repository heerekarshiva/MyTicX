-- ============================================================================
-- Migration: create the "ticket-uploads" Storage bucket + policies via SQL
-- Run this against any existing Supabase project that predates this change
-- (SQL editor or `supabase db push`).
--
-- Why: this bucket used to be a manual "click Create Bucket in the
-- dashboard" step documented only in the README. If it was skipped (or the
-- bucket name/visibility didn't match exactly), every ticket upload fails
-- with a generic "Could not store the file. Please try again." error. This
-- migration creates it idempotently so the setup can't be silently missed.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('ticket-uploads', 'ticket-uploads', false)
on conflict (id) do nothing;

drop policy if exists "ticket_uploads_select_own" on storage.objects;
create policy "ticket_uploads_select_own"
  on storage.objects for select
  using (bucket_id = 'ticket-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ticket_uploads_insert_own" on storage.objects;
create policy "ticket_uploads_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'ticket-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
