-- ============================================================================
-- TICX migration 0008: "Organize Your Event" platform.
-- Extends the existing events / event_registrations tables (migration 0006)
-- instead of replacing them. Safe to run more than once.
--
-- Everything the organizer can pick (event types, participant fields,
-- templates, rules) lives in tables, so new event kinds need NO code change.
-- All new tables are server-only: RLS is enabled with no client policies, and
-- every read/write goes through route handlers using the service role after
-- server-side authorization checks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Platform settings (admin-controlled key/value)
-- ---------------------------------------------------------------------------
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
alter table platform_settings enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Event types, field library, templates
-- ---------------------------------------------------------------------------
create table if not exists event_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  icon text not null default 'calendar',          -- lucide-style name, mapped in the UI
  collect_college_name boolean not null default false,
  allow_paid boolean not null default true,
  allow_custom_fields boolean not null default true,
  allow_field_editing boolean not null default true,  -- false = organizer must use template fields as-is
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists field_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null,
  field_type text not null check (field_type in ('text','textarea','email','phone','number','dropdown','date','checkbox')),
  placeholder text,
  options jsonb not null default '[]',             -- dropdown options: ["CSE","ECE",...]
  validation jsonb not null default '{}',          -- {minLength,maxLength,min,max,pattern,patternMessage}
  default_required boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists event_templates (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references event_types(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  allow_customization boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_templates_type on event_templates(event_type_id);

create table if not exists event_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references event_templates(id) on delete cascade,
  field_definition_id uuid not null references field_definitions(id) on delete cascade,
  is_required boolean not null default false,
  sort_order int not null default 0,
  unique (template_id, field_definition_id)
);

-- ---------------------------------------------------------------------------
-- 3. Organizers
-- ---------------------------------------------------------------------------
-- Role model: PARTICIPANT = any signed-in user, ORGANIZER = user with an ACTIVE
-- row here, ADMIN = profiles.role = 'admin' (unchanged). Kept separate from
-- profiles.role so the existing role check constraint is untouched.
create table if not exists event_organizers (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PENDING','SUSPENDED')),
  display_name text,
  organization text,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Extend events
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'events' and column_name = 'status') then
    alter table events add column status text not null default 'PUBLISHED';
    update events set status = case when is_active then 'PUBLISHED' else 'DRAFT' end;
    alter table events alter column status set default 'DRAFT';
  end if;
end $$;

alter table events
  add column if not exists event_type_id uuid references event_types(id) on delete set null,
  add column if not exists template_id uuid references event_templates(id) on delete set null,
  add column if not exists college_name text,
  add column if not exists organizer_name text,
  add column if not exists organizer_email text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,   -- start_at - cutoff (admin setting, default 30 min); recomputed on every schedule change
  add column if not exists registration_type text not null default 'FREE',
  add column if not exists currency text not null default 'INR',
  add column if not exists published_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- Drafts may be saved before a date / payment target exists.
alter table events alter column event_date drop not null;
alter table events alter column event_time drop not null;
alter table events alter column organizer_upi_id drop not null;
alter table events alter column organizer_payee_name drop not null;

alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check check (status in
  ('DRAFT','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING','COMPLETED','CANCELLED','SUSPENDED'));
alter table events drop constraint if exists events_registration_type_check;
alter table events add constraint events_registration_type_check check (registration_type in ('FREE','PAID'));
alter table events drop constraint if exists events_schedule_check;
alter table events add constraint events_schedule_check check (
  (start_at is null or end_at is null or start_at < end_at)
  and (registration_closes_at is null or start_at is null or registration_closes_at <= start_at)
);

-- Backfill legacy (migration 0006) events so they follow the same lifecycle and
-- 30-minute cutoff. Legacy rows had no timezone; Asia/Kolkata is assumed and
-- the end time defaults to start + 3h. Runs only for rows not yet backfilled.
update events set
  start_at = ((event_date + event_time) at time zone 'Asia/Kolkata'),
  registration_type = case when amount > 0 then 'PAID' else 'FREE' end
where start_at is null and event_date is not null and event_time is not null;
update events set end_at = start_at + interval '3 hours' where end_at is null and start_at is not null;
update events set registration_closes_at = start_at - interval '30 minutes' where registration_closes_at is null and start_at is not null;

create index if not exists idx_events_status_start on events(status, start_at);
create index if not exists idx_events_created_by on events(created_by);

-- ---------------------------------------------------------------------------
-- 5. Per-event participant fields (snapshot of the chosen configuration)
-- ---------------------------------------------------------------------------
create table if not exists event_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  definition_id uuid references field_definitions(id) on delete set null,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{0,59}$'),
  label text not null,
  field_type text not null check (field_type in ('text','textarea','email','phone','number','dropdown','date','checkbox')),
  placeholder text,
  options jsonb not null default '[]',
  validation jsonb not null default '{}',
  is_required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, field_key)
);
create index if not exists idx_event_fields_event on event_fields(event_id, sort_order);

-- ---------------------------------------------------------------------------
-- 6. Registrations: QR token + human-readable id, dynamic answers, check-ins
-- ---------------------------------------------------------------------------
alter table event_registrations
  add column if not exists registration_code text,
  add column if not exists check_in_token text;
create unique index if not exists uq_event_regs_code on event_registrations(registration_code) where registration_code is not null;
create unique index if not exists uq_event_regs_token on event_registrations(check_in_token) where check_in_token is not null;

-- Legacy confirmed registrations get a token so they can also check in.
update event_registrations
set check_in_token = translate(rtrim(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '='), '+/', '-_')
where status = 'CONFIRMED' and check_in_token is null;
update event_registrations
set registration_code = 'TX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where registration_code is null;

create table if not exists registration_field_values (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references event_registrations(id) on delete cascade,
  event_field_id uuid references event_fields(id) on delete set null,
  field_key text not null,
  label text not null,          -- snapshot, so exports stay correct even if a field is renamed
  value text,
  unique (registration_id, field_key)
);
create index if not exists idx_reg_values_reg on registration_field_values(registration_id);

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  registration_id uuid not null unique references event_registrations(id) on delete cascade,  -- UNIQUE = duplicate check-in is impossible
  participant_id uuid not null references profiles(id),
  organizer_id uuid not null references profiles(id),
  checked_in_at timestamptz not null default now()
);
create index if not exists idx_check_ins_event on check_ins(event_id);

alter table event_types enable row level security;
alter table field_definitions enable row level security;
alter table event_templates enable row level security;
alter table event_template_fields enable row level security;
alter table event_organizers enable row level security;
alter table event_fields enable row level security;
alter table registration_field_values enable row level security;
alter table check_ins enable row level security;

-- Events are read only through /api/events (service role). The old policy let
-- any anon-key client read every column of every active event, which would now
-- include organizer contact details, so restrict it to the owner.
drop policy if exists events_select_active_public on events;
drop policy if exists events_select_owner on events;
create policy events_select_owner on events for select using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Atomic registration: row-locks the event so capacity, deadline and
--    duplicate checks cannot race. The DB clock is the authority for the
--    deadline (registration_closes_at), independent of any browser or app clock.
-- ---------------------------------------------------------------------------
create or replace function register_for_event(
  p_event_id uuid, p_user_id uuid, p_status event_reg_status, p_amount numeric,
  p_code text, p_token text, p_answers jsonb
) returns event_registrations
language plpgsql security definer set search_path = public as $$
declare
  ev events;
  reg event_registrations;
  existing event_registrations;
  cnt int;
  had_existing boolean;
begin
  select * into ev from events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if ev.status in ('DRAFT','CANCELLED','SUSPENDED','COMPLETED') then raise exception 'EVENT_NOT_OPEN'; end if;
  if ev.registration_opens_at is not null and now() < ev.registration_opens_at then raise exception 'NOT_OPEN_YET'; end if;
  if ev.registration_closes_at is not null and now() >= ev.registration_closes_at then raise exception 'REGISTRATION_CLOSED'; end if;
  if ev.start_at is not null and now() >= ev.start_at then raise exception 'REGISTRATION_CLOSED'; end if;

  select * into existing from event_registrations where event_id = p_event_id and user_id = p_user_id;
  had_existing := found;   -- capture now: later SELECTs (the capacity count) reset FOUND
  if had_existing and existing.status not in ('CANCELLED','REJECTED') then raise exception 'ALREADY_REGISTERED'; end if;

  if ev.capacity is not null then
    select count(*) into cnt from event_registrations
      where event_id = p_event_id and status in ('PENDING_PAYMENT','SUBMITTED','CONFIRMED');
    if cnt >= ev.capacity then raise exception 'EVENT_FULL'; end if;
  end if;

  if had_existing then
    delete from registration_field_values where registration_id = existing.id;
    update event_registrations set
      status = p_status, amount = p_amount, utr = null, confirmed_at = case when p_status = 'CONFIRMED' then now() else null end,
      check_in_token = p_token, created_at = now()
    where id = existing.id returning * into reg;
  else
    insert into event_registrations (event_id, user_id, amount, status, confirmed_at, registration_code, check_in_token)
    values (p_event_id, p_user_id, p_amount, p_status, case when p_status = 'CONFIRMED' then now() else null end, p_code, p_token)
    returning * into reg;
  end if;

  insert into registration_field_values (registration_id, event_field_id, field_key, label, value)
  select reg.id, x.event_field_id, x.field_key, x.label, x.value
  from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb)) as x(event_field_id uuid, field_key text, label text, value text);

  return reg;
end $$;
revoke all on function register_for_event(uuid, uuid, event_reg_status, numeric, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage: public bucket for event posters (posters are not sensitive)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Seed configuration (idempotent). Everything below is editable from
--    /admin — this is only the starting point.
-- ---------------------------------------------------------------------------
insert into event_types (key, name, description, icon, collect_college_name, sort_order) values
  ('college_event', 'College Event', 'Organize college fests, workshops, seminars, cultural events, technical events, competitions and more.', 'graduation-cap', true, 1),
  ('other_event', 'Other Event', 'Organize public events, private events, meetups, workshops, shows and other activities.', 'calendar', false, 2)
on conflict (key) do nothing;

insert into field_definitions (key, label, field_type, placeholder, options, validation, default_required, sort_order) values
  ('full_name',   'Full Name',     'text',     'Your full name', '[]', '{"minLength":2,"maxLength":100}', true, 1),
  ('email',       'Email',         'email',    'you@example.com', '[]', '{}', true, 2),
  ('mobile',      'Mobile Number', 'phone',    '10-digit mobile number', '[]', '{}', true, 3),
  ('roll_number', 'Roll Number',   'text',     'e.g. 24XX123', '[]', '{"maxLength":40}', false, 4),
  ('department',  'Department',    'dropdown', null, '["CSE","ECE","EEE","ME","CIVIL","Other"]', '{}', false, 5),
  ('course',      'Course',        'text',     'e.g. B.Tech', '[]', '{"maxLength":60}', false, 6),
  ('class_year',  'Class/Year',    'dropdown', null, '["1st Year","2nd Year","3rd Year","4th Year","Other"]', '{}', false, 7),
  ('college_name','College Name',  'text',     'Your college', '[]', '{"maxLength":150}', false, 8),
  ('gender',      'Gender',        'dropdown', null, '["Male","Female","Other","Prefer not to say"]', '{}', false, 9),
  ('address',     'Address',       'textarea', 'Your address', '[]', '{"maxLength":300}', false, 10),
  ('city',        'Place/City',    'text',     'City', '[]', '{"maxLength":80}', false, 11),
  ('age',         'Age',           'number',   'Age', '[]', '{"min":1,"max":120}', false, 12),
  ('organization','Organization',  'text',     'Company / organization', '[]', '{"maxLength":120}', false, 13),
  ('id_number',   'ID Number',     'text',     'Government / institution ID', '[]', '{"maxLength":40}', false, 14)
on conflict (key) do nothing;

insert into event_templates (event_type_id, name, description, is_default)
select t.id, 'College Event Template', 'Name, roll number, department, class, email and mobile.', true
from event_types t where t.key = 'college_event'
  and not exists (select 1 from event_templates x where x.event_type_id = t.id);
insert into event_templates (event_type_id, name, description, is_default)
select t.id, 'Other Event Template', 'Name, mobile, email and city.', true
from event_types t where t.key = 'other_event'
  and not exists (select 1 from event_templates x where x.event_type_id = t.id);

insert into event_template_fields (template_id, field_definition_id, is_required, sort_order)
select tpl.id, fd.id, true, v.ord
from (values ('college_event','full_name',1),('college_event','roll_number',2),('college_event','department',3),
             ('college_event','class_year',4),('college_event','email',5),('college_event','mobile',6),
             ('other_event','full_name',1),('other_event','mobile',2),('other_event','email',3),('other_event','city',4)
     ) as v(type_key, field_key, ord)
join event_types t on t.key = v.type_key
join event_templates tpl on tpl.event_type_id = t.id and tpl.is_default
join field_definitions fd on fd.key = v.field_key
on conflict (template_id, field_definition_id) do nothing;

insert into platform_settings (key, value) values
  ('registration_cutoff_minutes', '30'),
  ('timezone', '"Asia/Kolkata"'),
  ('currency', '"INR"'),
  ('organizer_auto_approve', 'true'),
  ('allow_paid_events', 'true'),
  ('max_price', '100000'),
  ('max_poster_mb', '5'),
  ('max_custom_fields', '20'),
  ('pending_payment_hold_minutes', '30'),
  ('notify_organizer_on_registration', 'true'),
  ('organize_nav_enabled', 'true'),
  ('organize_nav_label', '"Organize Your Event"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Lifecycle sync. Called by /api/cron/sync-events and lazily on reads.
--     Reads also compute the status on the fly, so correctness never depends
--     on this having run — this just keeps the stored column current.
-- ---------------------------------------------------------------------------
create or replace function sync_event_statuses() returns void
language sql security definer set search_path = public as $$
  update events set status = case
      when end_at is not null and now() >= end_at then 'COMPLETED'
      when start_at is not null and now() >= start_at then 'ONGOING'
      when registration_closes_at is not null and now() >= registration_closes_at then 'REGISTRATION_CLOSED'
      when registration_opens_at is null or now() >= registration_opens_at then 'REGISTRATION_OPEN'
      else 'PUBLISHED' end,
    updated_at = now()
  where status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING')
    and start_at is not null
    and status <> case
      when end_at is not null and now() >= end_at then 'COMPLETED'
      when start_at is not null and now() >= start_at then 'ONGOING'
      when registration_closes_at is not null and now() >= registration_closes_at then 'REGISTRATION_CLOSED'
      when registration_opens_at is null or now() >= registration_opens_at then 'REGISTRATION_OPEN'
      else 'PUBLISHED' end;
$$;
revoke all on function sync_event_statuses() from public, anon, authenticated;
-- Optional (Supabase Pro / pg_cron enabled): select cron.schedule('ticx-sync-events','* * * * *','select sync_event_statuses()');
