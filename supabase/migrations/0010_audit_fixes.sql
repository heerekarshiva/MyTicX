-- TICX migration 0010: audit fixes. Safe to re-run.

-- 1) Refund retry tracking on payment_issues.
alter table payment_issues add column if not exists refund_attempts int not null default 0;
alter table payment_issues add column if not exists last_attempt_at timestamptz;
alter table payment_issues add column if not exists last_error text;
create index if not exists idx_payment_issues_open on payment_issues(refund_status, last_attempt_at)
  where refund_status in ('PENDING','REFUND_FAILED');

-- 2) Seller payout is created INSIDE the same transaction that marks the order PAID,
--    so a crash can never leave a paid order with no payout. Only for PhonePe-collected money
--    (manual UPI orders are paid by the buyer directly to the seller, so nothing is owed).
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

  if exists (select 1 from payments where order_id = p_order_id and provider = 'phonepe' and status = 'SUCCEEDED') then
    insert into seller_payouts (order_id, seller_id, amount)
    values (v_order.id, v_order.seller_id, v_order.ticket_price)
    on conflict (order_id) do nothing;
  end if;
end $$;

-- 3) Backfill: any PhonePe-paid order that is missing its payout row.
insert into seller_payouts (order_id, seller_id, amount)
select o.id, o.seller_id, o.ticket_price
from orders o
where o.status in ('PAID','TRANSFERRED')
  and exists (select 1 from payments p where p.order_id = o.id and p.provider = 'phonepe' and p.status = 'SUCCEEDED')
  and not exists (select 1 from seller_payouts sp where sp.order_id = o.id)
on conflict (order_id) do nothing;

-- 4) Idempotency keys are scoped to the buyer: one buyer can never be handed another buyer's order.
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
  select * into v_existing_order from orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_order.buyer_id <> p_buyer_id then raise exception 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    return query select v_existing_order.id, v_existing_order.ticket_price,
      v_existing_order.platform_fee, v_existing_order.total_amount;
    return;
  end if;

  select * into v_listing from ticket_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if v_listing.status <> 'ACTIVE' then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  if v_listing.seller_id = p_buyer_id then raise exception 'CANNOT_BUY_OWN_LISTING'; end if;

  select * into v_ticket from tickets where id = v_listing.ticket_id for update;
  if v_ticket.status <> 'LISTED' then raise exception 'TICKET_NOT_AVAILABLE'; end if;

  v_total := v_listing.resale_price + v_listing.platform_fee;

  update ticket_listings
    set status = 'RESERVED', reserved_by = p_buyer_id, reserved_at = now(),
        reservation_expires_at = now() + interval '15 minutes', updated_at = now()
    where id = p_listing_id;

  update tickets set status = 'RESERVED', updated_at = now() where id = v_ticket.id;

  insert into orders (listing_id, buyer_id, seller_id, ticket_price, platform_fee, total_amount, status, idempotency_key)
  values (p_listing_id, p_buyer_id, v_listing.seller_id, v_listing.resale_price, v_listing.platform_fee, v_total, 'PAYMENT_PENDING', p_idempotency_key)
  returning * into v_existing_order;

  return query select v_existing_order.id, v_existing_order.ticket_price,
    v_existing_order.platform_fee, v_existing_order.total_amount;
end;
$$;
