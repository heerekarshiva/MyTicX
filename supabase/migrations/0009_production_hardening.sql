-- TICX migration 0009: production hardening. Safe to re-run.

-- 1) Sold-out lock: a listing can never have two live orders, and a paid listing can never be bought again.
create unique index if not exists uq_orders_one_open_per_listing
  on orders(listing_id) where status in ('CREATED','PAYMENT_PENDING','PAID','TRANSFERRED');
create index if not exists idx_orders_status_listing on orders(listing_id, status);
create index if not exists idx_listings_active_created on ticket_listings(created_at desc) where status = 'ACTIVE';
create index if not exists idx_listings_reserved_exp on ticket_listings(reservation_expires_at) where status = 'RESERVED';
create index if not exists idx_payments_order on payments(order_id);

-- 2) Late payments: if the buyer paid right as the reservation expired and nobody else took the ticket, still honour it.
--    If someone else already bought it, raise ORDER_NOT_PAYABLE so the app refunds automatically.
create or replace function finalize_paid_order(p_order_id uuid) returns void
language plpgsql as $$
declare
  v_order orders%rowtype;
  v_listing ticket_listings%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('PAID','TRANSFERRED') then return; end if;

  select * into v_listing from ticket_listings where id = v_order.listing_id for update;

  if v_order.status = 'CANCELLED' then
    -- expired reservation that was released; only revive it if the ticket is still free
    if v_listing.status <> 'ACTIVE' then raise exception 'ORDER_NOT_PAYABLE'; end if;
    if exists (select 1 from orders o where o.listing_id = v_order.listing_id and o.id <> v_order.id
               and o.status in ('CREATED','PAYMENT_PENDING','PAID','TRANSFERRED')) then
      raise exception 'ORDER_NOT_PAYABLE';
    end if;
  elsif v_order.status <> 'PAYMENT_PENDING' then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  update orders set status = 'PAID', updated_at = now() where id = p_order_id;
  update ticket_listings set status = 'SOLD', sold_at = now(), reserved_by = null, reservation_expires_at = null, updated_at = now() where id = v_order.listing_id;
  update tickets set status = 'SOLD', updated_at = now() where id = v_listing.ticket_id;

  insert into ticket_transfers (order_id, ticket_id, from_user_id, to_user_id, status)
  values (v_order.id, v_listing.ticket_id, v_order.seller_id, v_order.buyer_id, 'PENDING');

  insert into notifications (user_id, type, title, body) values
    (v_order.buyer_id, 'PAYMENT_COMPLETED', 'Payment successful', 'Your ticket purchase is confirmed.'),
    (v_order.seller_id, 'TICKET_SOLD', 'Your ticket sold', 'Your listed ticket has been purchased.');
end $$;

-- 3) Money that needs a human or an automatic refund.
create table if not exists payment_issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  kind text not null,                       -- ORDER_NOT_PAYABLE | AMOUNT_MISMATCH
  amount numeric(10,2),
  refund_status text not null default 'PENDING',   -- PENDING | REFUND_INITIATED | REFUND_FAILED | RESOLVED
  detail text,
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);
alter table payment_issues enable row level security;
drop policy if exists payment_issues_no_client on payment_issues;
create policy payment_issues_no_client on payment_issues for select using (false);

-- 4) Seller payouts: PhonePe settles to YOUR merchant account, so each paid order creates a payout you owe the seller.
create table if not exists seller_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  seller_id uuid not null references profiles(id),
  amount numeric(10,2) not null,            -- ticket price only; platform fee stays with you
  status text not null default 'PENDING',   -- PENDING | PAID
  utr text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_payouts_status on seller_payouts(status, created_at);
alter table seller_payouts enable row level security;
drop policy if exists payouts_select_own on seller_payouts;
create policy payouts_select_own on seller_payouts for select using (seller_id = auth.uid());

-- 5) Shared rate limiter (works across any number of server instances and survives deploys).
create table if not exists rate_limits (
  key text primary key,
  count int not null,
  reset_at timestamptz not null
);
alter table rate_limits enable row level security;
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer as $$
declare v_count int;
begin
  insert into rate_limits(key, count, reset_at) values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => p_window_seconds) else rate_limits.reset_at end
  returning count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
create or replace function purge_rate_limits() returns void language sql as $$ delete from rate_limits where reset_at < now() - interval '1 hour' $$;

-- 6) Sync job also releases expired reservations (so /api/purchase no longer has to).
create or replace function release_expired_reservations() returns int
language plpgsql as $$
declare n int;
begin
  with expired as (
    update ticket_listings
       set status = 'ACTIVE', reserved_by = null, reserved_at = null, reservation_expires_at = null, updated_at = now()
     where status = 'RESERVED' and reservation_expires_at < now()
    returning id, ticket_id
  ), t as (
    update tickets set status = 'LISTED', updated_at = now() where id in (select ticket_id from expired)
  ), o as (
    update orders set status = 'CANCELLED', updated_at = now()
     where status = 'PAYMENT_PENDING' and listing_id in (select id from expired)
  )
  select count(*) into n from expired;
  return n;
end $$;
