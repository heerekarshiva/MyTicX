# Concurrent purchase test (manual / integration)

This is documented here rather than as a pure unit test because it requires
a real Postgres connection to exercise row locking (`FOR UPDATE`) under
genuine concurrency — a mocked client can't demonstrate that the lock works.

## Setup
1. Apply `supabase/schema.sql` to a local or scratch Supabase project.
2. Seed one ACTIVE listing (see `supabase/seed.sql`).
3. Create two buyer accounts, A and B.

## Test
Fire two requests at `/api/purchase` for the SAME `listingId`, from A and B,
as close together as possible (e.g. `Promise.all([...])` from a script using
each user's session, or `pgbench`-style concurrent calls directly against
`reserve_listing_for_purchase` via `psql`):

```sql
select * from reserve_listing_for_purchase('<listing-id>', '<user-a-id>', 'test-key-a');
select * from reserve_listing_for_purchase('<listing-id>', '<user-b-id>', 'test-key-b');
```

## Expected result
- Exactly one call succeeds and returns an order row.
- The other raises `LISTING_NOT_AVAILABLE` (surfaced by the API route as
  "Sorry, this ticket has just been purchased.").
- `select status from ticket_listings where id = '<listing-id>'` shows
  exactly one RESERVED/SOLD row — never a state where both orders exist.

This is guaranteed by the `for update` row lock inside
`reserve_listing_for_purchase` (see `supabase/schema.sql`): the second
transaction blocks until the first commits, then re-reads the now-changed
`status` and correctly fails, rather than racing on a stale read.
