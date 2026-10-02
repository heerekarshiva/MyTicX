# Audit fixes (migration 0010 + code)
1. Migration 0007 now drops the old `release_expired_reservations()` (void) before recreating it as `returns int`; fresh installs no longer fail.
2. `finalize_paid_order` creates the seller payout in the same transaction (PhonePe-collected orders only). Missing payouts are backfilled. `settle.ts` also re-checks on every call.
3. Failed refunds are retried by the cron (spaced, max 10 attempts) and by an admin "Retry refund" button; attempts and last error are stored on `payment_issues`. `payments.status` becomes REFUNDED on a successful refund.
4. Idempotency keys are namespaced per user in the API and checked per buyer in `reserve_listing_for_purchase`.
5. PhonePe `expireAfter` is always >= 300s (their minimum): a nearly-expired reservation is extended for its own holder (cap: 30 min total) instead of failing with a 502. See `lib/payments/hold.ts`.
6. Double-clicking Buy returns the buyer's existing order instead of a 409.
7. `release_expired_reservations` sets `orders.updated_at`.
8. render.yaml: warning that CRON_SECRET / NEXT_PUBLIC_APP_URL must match on the web service and the cron job.
Run order: schema.sql, then migrations 0002 ... 0010. Manual test steps for the late-payment/refund paths: tests/late-payment.md.
