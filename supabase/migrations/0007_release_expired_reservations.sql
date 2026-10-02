-- TICX migration 0007: fix repeated "409" on /api/purchase.
-- Cause: a reservation lasts 15 minutes, but nothing ever released it. Once a
-- buyer abandoned checkout the listing stayed RESERVED forever, so every later
-- purchase attempt failed with LISTING_NOT_AVAILABLE (HTTP 409).
-- This function releases expired reservations; /api/purchase calls it first.
-- schema.sql defined this function as `returns void`; Postgres cannot change a return type with CREATE OR REPLACE.
drop function if exists release_expired_reservations();
create or replace function release_expired_reservations() returns int
language plpgsql as $$
declare n int;
begin
  with expired as (
    update ticket_listings
       set status = 'ACTIVE', reserved_by = null, reserved_at = null,
           reservation_expires_at = null, updated_at = now()
     where status = 'RESERVED' and reservation_expires_at < now()
    returning id, ticket_id
  ), t as (
    update tickets set status = 'LISTED', updated_at = now()
     where id in (select ticket_id from expired)
  ), o as (
    update orders set status = 'CANCELLED', updated_at = now()
     where status = 'PAYMENT_PENDING' and listing_id in (select id from expired)
  )
  select count(*) into n from expired;
  return n;
end $$;
