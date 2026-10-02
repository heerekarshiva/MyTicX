-- ============================================================================
-- Migration: ticket link field + manual UPI payment confirmation
-- Run this against your existing Supabase project (SQL editor or `supabase
-- db push` if you keep migrations in sync with schema.sql).
-- ============================================================================

-- 1) Ticket / booking link captured alongside the screenshot on the sell flow.
alter table tickets add column if not exists ticket_link text;

-- 2) Each SELLER's own UPI ID, entered by them in their profile. This is
--    intentionally per-user and never hardcoded anywhere in the app — do not
--    put a real UPI ID in source code or in this file.
alter table profiles add column if not exists upi_id text;
alter table profiles add column if not exists upi_payee_name text;

-- 3) Manual payment proof. There is no payment-gateway API involved when a
--    buyer pays a seller's personal UPI ID directly (PhonePe/GPay/etc. don't
--    expose one to individual account holders), so this cannot be verified
--    automatically. This table records what a real gateway's webhook would
--    normally provide: instead, the BUYER submits the UTR/reference number
--    (and optionally a screenshot) after paying, and the SELLER confirms
--    receipt before the order is finalized. Treat 'CONFIRMED' as
--    "the seller says they got paid", not as a cryptographic guarantee.
do $$ begin
  create type manual_payment_status as enum ('SUBMITTED','CONFIRMED','REJECTED');
exception when duplicate_object then null; end $$;

create table if not exists manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  utr text not null,                 -- UPI transaction / reference number the buyer entered
  screenshot_path text,              -- optional, private storage bucket path
  status manual_payment_status not null default 'SUBMITTED',
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_payment_proofs_order on manual_payment_proofs(order_id);
create index if not exists idx_manual_payment_proofs_seller on manual_payment_proofs(seller_id, status);

-- RLS: buyers can see/insert their own proofs, sellers can see/update
-- (confirm) proofs for orders where they're the seller. Adjust to match
-- however you've set up RLS elsewhere in this project.
alter table manual_payment_proofs enable row level security;

drop policy if exists "buyer can insert own proof" on manual_payment_proofs;
create policy "buyer can insert own proof" on manual_payment_proofs
  for insert to authenticated
  with check (buyer_id = auth.uid());

drop policy if exists "buyer or seller can read own proof" on manual_payment_proofs;
create policy "buyer or seller can read own proof" on manual_payment_proofs
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Sellers confirm via the service-role API route (app/api/payments/manual/confirm),
-- not directly from the client, so no client-side UPDATE policy is granted here.
