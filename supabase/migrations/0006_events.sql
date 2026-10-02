-- ============================================================================
-- TICX migration 0006: "Organize Event" — admin-created events, users pay via
-- UPI QR and register. Independent of the ticket-resale marketplace.
-- ============================================================================

do $$ begin
  create type event_reg_status as enum ('PENDING_PAYMENT','SUBMITTED','CONFIRMED','REJECTED','CANCELLED');
exception when duplicate_object then null; end $$;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id),
  event_type text not null,              -- Concert / Meetup / Workshop / Competition / Other
  title text not null,
  description text,
  details text,                          -- what to bring / what's included / rules etc.
  venue text,
  city text,
  event_date date not null,
  event_time time not null,
  amount numeric(10,2) not null check (amount >= 0),
  organizer_upi_id text not null,
  organizer_payee_name text not null,
  poster_url text,
  capacity int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_active_date on events(is_active, event_date);

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id),
  amount numeric(10,2) not null,
  status event_reg_status not null default 'PENDING_PAYMENT',
  utr text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_event_regs_event on event_registrations(event_id, status);

alter table events enable row level security;
alter table event_registrations enable row level security;

drop policy if exists events_select_active_public on events;
create policy events_select_active_public on events for select
  using (is_active or created_by = auth.uid());
-- No client insert/update: events are created/edited only via /api/admin/events
-- (service role, checks profiles.role = 'admin' server-side).

drop policy if exists event_regs_select_own_or_organizer on event_registrations;
create policy event_regs_select_own_or_organizer on event_registrations for select
  using (
    user_id = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid())
  );
-- No client insert/update: registrations are created/confirmed only via
-- /api/events/[id]/register and /api/admin/events/registrations/[id].
