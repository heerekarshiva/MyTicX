-- ============================================================================
-- TicketSwap — Core Database Schema (Supabase / PostgreSQL)
-- Run in order. Idempotent-ish (guards with IF NOT EXISTS where practical).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
do $$ begin
  create type verification_status as enum (
    'UNVERIFIED','PENDING','DOCUMENT_VERIFIED','PROVIDER_VERIFIED','REJECTED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum (
    'UPLOADED','VERIFYING','VERIFIED','LISTED','RESERVED','SOLD','TRANSFERRED',
    'REJECTED','EXPIRED','CANCELLED','BLOCKED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum (
    'PENDING_VERIFICATION','ACTIVE','RESERVED','SOLD','EXPIRED','REJECTED','CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'CREATED','PAYMENT_PENDING','PAID','TRANSFERRED','CANCELLED','FAILED','REFUNDED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('PENDING','SUCCEEDED','FAILED','REFUNDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fraud_state as enum ('NORMAL','REVIEW','BLOCKED');
exception when duplicate_object then null; end $$;

-- See supabase/migrations/0002_manual_upi_payments.sql for the full story:
-- 'CONFIRMED' means the seller says they received payment, not a
-- gateway-verified fact — there is no automatic verification for a payment
-- made directly to a personal UPI ID.
do $$ begin
  create type manual_payment_status as enum ('SUBMITTED','CONFIRMED','REJECTED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- CORE REFERENCE TABLES
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  phone_verified boolean not null default false,
  role text not null default 'user' check (role in ('user','admin')),
  fraud_state fraud_state not null default 'NORMAL',
  -- Seller's own UPI ID for receiving manual UPI payments. Per-user, set by
  -- the user themselves in their profile — never hardcode a real UPI ID here.
  upi_id text,
  upi_payee_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text,
  country text not null default 'IN',
  unique (city, state, country)
);

create table if not exists theatres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid not null references locations(id),
  address text,
  external_ref text -- id from the movie/show provider, for reconciliation
);

create table if not exists movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text,
  genre text,
  duration_minutes int,
  rating text,
  poster_url text,
  description text,
  external_ref text
);

create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references movies(id),
  theatre_id uuid not null references theatres(id),
  show_date date not null,
  show_time time not null,
  base_price numeric(10,2) not null,
  external_ref text,
  created_at timestamptz not null default now()
);
create index if not exists idx_shows_movie_date on shows(movie_id, show_date);
create index if not exists idx_shows_theatre_date on shows(theatre_id, show_date);

create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references shows(id),
  seat_label text not null,
  category text default 'standard'
);

-- ---------------------------------------------------------------------------
-- TICKETS — the seller's uploaded/claimed ticket, independent of listing
-- ---------------------------------------------------------------------------
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  show_id uuid references shows(id),
  seat_id uuid references seats(id),
  provider text not null default 'manual',       -- e.g. bookmyshow, manual
  booking_reference text not null,                -- provider booking id, as entered/extracted
  seat_label text,
  original_price numeric(10,2) not null,
  file_path text,                                  -- path in private storage bucket
  file_hash text,                                   -- sha256 of the uploaded file's raw bytes
  ticket_link text,                                  -- link to the original booking, entered by the seller
  extracted_data jsonb,                             -- OCR/parse output (never public)
  -- Deterministic identity fingerprint. Prevents the same real-world ticket
  -- being uploaded/listed more than once, even across different accounts.
  fingerprint text not null,
  status ticket_status not null default 'UPLOADED',
  verification_status verification_status not null default 'UNVERIFIED',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRITICAL: a given real-world ticket (by fingerprint) may only ever be
-- represented by ONE non-terminal ticket row. Terminal states (REJECTED,
-- CANCELLED, BLOCKED) are excluded so a corrected re-upload is possible,
-- but UPLOADED/VERIFYING/VERIFIED/LISTED/RESERVED/SOLD/TRANSFERRED cannot
-- coexist under the same fingerprint.
create unique index if not exists uq_tickets_fingerprint_active
  on tickets(fingerprint)
  where status not in ('REJECTED','CANCELLED','BLOCKED','EXPIRED');

-- SEPARATE guard at the file level: even if two ticket submissions somehow
-- carry different typed-in booking details, the exact same uploaded
-- PDF/image (by content hash) can never back more than one active ticket.
-- This catches "same screenshot re-uploaded under a different booking ID"
-- attempts that the fingerprint check alone wouldn't see.
create unique index if not exists uq_tickets_file_hash_active
  on tickets(file_hash)
  where file_hash is not null and status not in ('REJECTED','CANCELLED','BLOCKED','EXPIRED');

create index if not exists idx_tickets_owner on tickets(owner_id);

create table if not exists ticket_verifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  step text not null,             -- e.g. 'movie_match','theatre_match','duplicate_check'
  passed boolean not null,
  detail text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- LISTINGS — the resale offer created from a VERIFIED ticket
-- ---------------------------------------------------------------------------
create table if not exists ticket_listings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  seller_id uuid not null references profiles(id),
  resale_price numeric(10,2) not null,
  platform_fee numeric(10,2) not null,
  status listing_status not null default 'PENDING_VERIFICATION',
  reserved_by uuid references profiles(id),
  reserved_at timestamptz,
  reservation_expires_at timestamptz,
  sold_at timestamptz,
  expires_at timestamptz, -- typically show start time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRITICAL: a ticket may have only ONE listing that is not terminal.
-- This is the DB-level guarantee behind "a ticket can have only one
-- active listing" — enforced regardless of what the frontend does.
create unique index if not exists uq_listing_one_active_per_ticket
  on ticket_listings(ticket_id)
  where status in ('PENDING_VERIFICATION','ACTIVE','RESERVED');

create index if not exists idx_listings_status on ticket_listings(status);
create index if not exists idx_listings_seller on ticket_listings(seller_id);

-- ---------------------------------------------------------------------------
-- ORDERS / PAYMENTS / TRANSFERS
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references ticket_listings(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  ticket_price numeric(10,2) not null,
  platform_fee numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  status order_status not null default 'CREATED',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_seller on orders(seller_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null,
  provider_payment_id text,
  amount numeric(10,2) not null,
  status payment_status not null default 'PENDING',
  idempotency_key text not null unique,
  raw_webhook_payload jsonb,
  created_at timestamptz not null default now()
);

-- Manual UPI payment proof — used when PAYMENT_PROVIDER has no real gateway
-- wired in and a buyer pays the seller's personal UPI ID directly instead.
-- See supabase/migrations/0002_manual_upi_payments.sql for the full notes.
create table if not exists manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  utr text not null,
  screenshot_path text,
  status manual_payment_status not null default 'SUBMITTED',
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_manual_payment_proofs_order on manual_payment_proofs(order_id);
create index if not exists idx_manual_payment_proofs_seller on manual_payment_proofs(seller_id, status);

create table if not exists ticket_transfers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  ticket_id uuid not null references tickets(id),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  method text not null default 'internal', -- internal | provider_api
  status text not null default 'PENDING',
  transferred_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SUPPORTING TABLES
-- ---------------------------------------------------------------------------
create table if not exists seller_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

-- NOTE: there is intentionally no `phone_verifications` table. Phone
-- verification codes are generated, emailed, expired, and checked entirely
-- by Supabase Auth's built-in email OTP (see
-- app/api/phone/send-otp/route.ts and .../verify-otp/route.ts) — this app
-- only ever writes the final result to profiles.phone / phone_verified once
-- Supabase confirms the code. If you're upgrading an existing database that
-- still has this table, see supabase/migrations/0003_supabase_email_otp.sql.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  listing_id uuid references ticket_listings(id),
  sender_id uuid not null references profiles(id),
  recipient_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  reported_user_id uuid references profiles(id),
  listing_id uuid references ticket_listings(id),
  reason text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table if not exists favorites (
  user_id uuid not null references profiles(id),
  movie_id uuid not null references movies(id),
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  query text,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CONSENTS — explicit, timestamped acknowledgement of platform terms.
-- Recorded server-side whenever a seller publishes a listing or a buyer
-- completes a purchase, so there is an evidentiary record if a fraud/refund
-- dispute is later raised. This is what backs the "you accepted these
-- terms" disclosure shown in the UI before listing/purchase.
-- ---------------------------------------------------------------------------
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  consent_type text not null check (consent_type in ('SELLER_LISTING_TERMS','BUYER_PURCHASE_RISK')),
  listing_id uuid references ticket_listings(id),
  order_id uuid references orders(id),
  terms_version text not null default 'v1',
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);
create index if not exists idx_consents_user on consents(user_id);

-- ============================================================================
-- THE ATOMIC PURCHASE FUNCTION
-- This is what actually prevents two buyers from both "winning" the same
-- ticket. It runs server-side (via service role, from a server action /
-- edge function — never called directly with the anon key from the client)
-- inside a single transaction with a row lock, so under concurrent calls
-- only one commits successfully.
-- ============================================================================
create or replace function reserve_listing_for_purchase(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_idempotency_key text
) returns table (order_id uuid, ticket_price numeric, platform_fee numeric, total_amount numeric)
language plpgsql
as $$
declare
  v_listing ticket_listings%rowtype;
  v_ticket tickets%rowtype;
  v_existing_order orders%rowtype;
  v_total numeric(10,2);
begin
  -- Idempotency: if this exact request was already processed, return it.
  select * into v_existing_order from orders where idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing_order.id, v_existing_order.ticket_price,
      v_existing_order.platform_fee, v_existing_order.total_amount;
    return;
  end if;

  -- Lock the listing row. Under concurrent requests, the second call blocks
  -- here until the first transaction commits or rolls back, then re-reads
  -- the now-updated status and correctly fails.
  select * into v_listing from ticket_listings where id = p_listing_id for update;

  if not found then
    raise exception 'LISTING_NOT_FOUND';
  end if;

  if v_listing.status <> 'ACTIVE' then
    raise exception 'LISTING_NOT_AVAILABLE';
  end if;

  if v_listing.seller_id = p_buyer_id then
    raise exception 'CANNOT_BUY_OWN_LISTING';
  end if;

  select * into v_ticket from tickets where id = v_listing.ticket_id for update;
  if v_ticket.status <> 'LISTED' then
    raise exception 'TICKET_NOT_AVAILABLE';
  end if;

  v_total := v_listing.resale_price + v_listing.platform_fee;

  update ticket_listings
    set status = 'RESERVED',
        reserved_by = p_buyer_id,
        reserved_at = now(),
        reservation_expires_at = now() + interval '15 minutes',
        updated_at = now()
    where id = p_listing_id;

  update tickets set status = 'RESERVED', updated_at = now() where id = v_ticket.id;

  insert into orders (listing_id, buyer_id, seller_id, ticket_price, platform_fee, total_amount, status, idempotency_key)
  values (p_listing_id, p_buyer_id, v_listing.seller_id, v_listing.resale_price, v_listing.platform_fee, v_total, 'PAYMENT_PENDING', p_idempotency_key)
  returning * into v_existing_order;

  return query select v_existing_order.id, v_existing_order.ticket_price,
    v_existing_order.platform_fee, v_existing_order.total_amount;
end;
$$;

-- Called by the payment webhook handler ONLY, after server-side payment
-- verification succeeds. Never called on the client's say-so.
create or replace function finalize_paid_order(p_order_id uuid) returns void
language plpgsql as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'PAID' then return; end if; -- idempotent
  if v_order.status <> 'PAYMENT_PENDING' then raise exception 'ORDER_NOT_PAYABLE'; end if;

  update orders set status = 'PAID', updated_at = now() where id = p_order_id;
  update ticket_listings set status = 'SOLD', sold_at = now(), updated_at = now() where id = v_order.listing_id;
  update tickets set status = 'SOLD', updated_at = now()
    where id = (select ticket_id from ticket_listings where id = v_order.listing_id);

  insert into ticket_transfers (order_id, ticket_id, from_user_id, to_user_id, status)
  select v_order.id, tl.ticket_id, v_order.seller_id, v_order.buyer_id, 'PENDING'
  from ticket_listings tl where tl.id = v_order.listing_id;

  insert into notifications (user_id, type, title, body)
  values
    (v_order.buyer_id, 'PAYMENT_COMPLETED', 'Payment successful', 'Your ticket purchase is confirmed.'),
    (v_order.seller_id, 'TICKET_SOLD', 'Your ticket sold', 'Your listed ticket has been purchased.');
end;
$$;

-- Releases an expired reservation back to ACTIVE (called by a scheduled job).
create or replace function release_expired_reservations() returns void
language plpgsql as $$
begin
  update ticket_listings
    set status = 'ACTIVE', reserved_by = null, reserved_at = null, reservation_expires_at = null
    where status = 'RESERVED' and reservation_expires_at < now();
  update tickets t set status = 'LISTED'
    from ticket_listings tl
    where tl.ticket_id = t.id and tl.status = 'ACTIVE' and t.status = 'RESERVED';
end;
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table tickets enable row level security;
alter table ticket_verifications enable row level security;
alter table ticket_listings enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table ticket_transfers enable row level security;
alter table notifications enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table favorites enable row level security;
alter table search_history enable row level security;
alter table seller_verifications enable row level security;
alter table audit_logs enable row level security;
alter table consents enable row level security;

-- profiles: user sees/edits only their own row
create policy profiles_select_own on profiles for select using (auth.uid() = id);
create policy profiles_update_own on profiles for update using (auth.uid() = id);
create policy profiles_insert_own on profiles for insert with check (auth.uid() = id);

-- tickets: owner-only visibility; no client-side updates to status/verification
create policy tickets_select_own on tickets for select using (auth.uid() = owner_id);
create policy tickets_insert_own on tickets for insert with check (auth.uid() = owner_id);
-- No update/delete policy for regular users: status transitions happen only
-- via server-side (service role) verification & purchase logic.

create policy ticket_verifications_select_own on ticket_verifications for select
  using (exists (select 1 from tickets t where t.id = ticket_id and t.owner_id = auth.uid()));

-- listings: ACTIVE listings are publicly browsable (marketplace); sellers
-- see all statuses of their own listings.
create policy listings_select_active_public on ticket_listings for select
  using (status = 'ACTIVE' or seller_id = auth.uid() or reserved_by = auth.uid());
create policy listings_insert_own on ticket_listings for insert with check (seller_id = auth.uid());
-- Sellers may only cancel while still pending/active — not flip to SOLD etc.
create policy listings_update_own_cancel on ticket_listings for update
  using (seller_id = auth.uid() and status in ('PENDING_VERIFICATION','ACTIVE'));

-- orders: visible to buyer or seller only
create policy orders_select_participant on orders for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());
-- No direct insert/update policy: orders are created/mutated only through
-- the reserve_listing_for_purchase / finalize_paid_order functions, invoked
-- from server code using the service role key.

-- payments: never directly readable/writable by clients
create policy payments_no_client_access on payments for select using (false);

-- transfers: visible to the two parties
create policy transfers_select_participant on ticket_transfers for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- notifications: own only
create policy notifications_select_own on notifications for select using (user_id = auth.uid());
create policy notifications_update_own on notifications for update using (user_id = auth.uid());

-- messages: sender or recipient only
create policy messages_select_participant on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy messages_insert_as_sender on messages for insert with check (sender_id = auth.uid());

-- reports: reporter can create & view own reports
create policy reports_select_own on reports for select using (reporter_id = auth.uid());
create policy reports_insert_own on reports for insert with check (reporter_id = auth.uid());

-- favorites / search history: own only
create policy favorites_all_own on favorites for all using (user_id = auth.uid());
create policy search_history_all_own on search_history for all using (user_id = auth.uid());

-- seller_verifications, audit_logs: no direct client access
create policy seller_verif_select_own on seller_verifications for select using (user_id = auth.uid());
create policy audit_logs_no_client on audit_logs for select using (false);
-- Consents: a user may view their own consent history (e.g. "what did I
-- agree to"); creation happens only server-side via the service role, tied
-- to an actual listing/purchase action, never a bare client insert.
create policy consents_select_own on consents for select using (user_id = auth.uid());

-- Reference/catalog tables (movies, theatres, shows, seats, locations) are
-- public read-only; writes happen only via the service role / provider sync.
alter table movies enable row level security;
alter table theatres enable row level security;
alter table shows enable row level security;
alter table seats enable row level security;
alter table locations enable row level security;
create policy movies_public_read on movies for select using (true);
create policy theatres_public_read on theatres for select using (true);
create policy shows_public_read on shows for select using (true);
create policy seats_public_read on seats for select using (true);
create policy locations_public_read on locations for select using (true);

-- ============================================================================
-- MARKETPLACE VIEW — a stable, flat shape for the public "buy tickets" list.
-- Querying this view from the app is far less fragile than a deeply nested
-- join, and keeps the RLS-sensitive tables' exact column names decoupled
-- from what the frontend depends on.
-- ============================================================================
create or replace view marketplace_listings_view as
select
  tl.id as listing_id,
  tl.resale_price,
  tl.platform_fee,
  tl.status,
  tl.created_at,
  t.original_price,
  t.seat_label,
  t.verification_status,
  m.title as movie_title,
  th.name as theatre_name,
  loc.city as location,
  s.show_date,
  s.show_time,
  p.phone_verified as seller_phone_verified,
  tl.seller_id
from ticket_listings tl
join tickets t on t.id = tl.ticket_id
left join shows s on s.id = t.show_id
left join movies m on m.id = s.movie_id
left join theatres th on th.id = s.theatre_id
left join locations loc on loc.id = th.location_id
join profiles p on p.id = tl.seller_id;

-- The view inherits RLS from its underlying tables when queried as a normal
-- user (security_invoker semantics on Postgres 15+); on older Postgres,
-- explicitly filter by status = 'ACTIVE' in application queries as done in
-- the /api/listings GET route, and additionally restrict with:
alter view marketplace_listings_view set (security_invoker = true);

-- Storage: the "ticket-uploads" bucket, created here (not as a manual
-- dashboard step) so a fresh `schema.sql` run is enough on its own — no
-- separate click-through setup to forget. Files are only ever written via
-- the service-role client (app/api/upload-ticket/route.ts bypasses these
-- policies entirely); the policies below matter only if you ever add
-- direct-from-browser storage access using the anon key.
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
-- ---------------------------------------------------------------------------

-- TICX additions: see supabase/migrations/0005_ticx_movies_reviews_chat.sql (run it after this file).

-- TICX events feature: see supabase/migrations/0006_events.sql (run it after 0005).
