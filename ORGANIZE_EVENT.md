# Organize Your Event — setup & reference

## 1. Setup (5 steps)
1. `npm install` (adds `jsqr`, the camera-scan fallback for Safari/Firefox)
2. Run `supabase/migrations/0008_event_platform.sql` in the Supabase SQL editor (safe to re-run; it upgrades existing 0006 events in place and seeds College/Other types, 14 fields, 2 templates, settings)
3. Add `CRON_SECRET=<long random string>` to `.env.local` (see `.env.example`)
4. Make yourself admin: `update profiles set role='admin' where id = '<your auth user id>';`
5. (Recommended) every minute call `GET /api/cron/sync-events` with header `Authorization: Bearer $CRON_SECRET` (Render cron job / cron-job.org). Optional — see "Deadline" below.

## 2. Where things are
| Who | URL |
|---|---|
| Anyone | nav **Organize Your Event** (new tab) → `/organize-event`, `/events`, `/events/[id]` |
| Participant | `/my-registrations` (QR pass), `/events/[id]` |
| Organizer | `/organizer/dashboard`, `/organizer/events/[id]/participants`, `/organizer/events/[id]/scan`, `/organize-event?edit=<id>` |
| Admin | `/admin` (stats) · `/admin/events` · `/admin/event-types` · `/admin/fields` · `/admin/templates` · `/admin/organizers` · `/admin/settings` |

Admin controls: event types (+ rules: college-name, allow paid, allow custom fields, lock template fields), the field library (label/key/type/placeholder/validation/options/active), templates, organizers (approve/suspend), and settings (cutoff minutes, timezone, max price, poster size, auto-approve organizers, nav label/visibility…). New event type = admin screens only, no code.

## 3. Registration deadline (30 minutes before start)
`registration_closes_at = start_at − cutoff` is stored on every save. Enforced in three independent places:
1. **Postgres** `register_for_event()` rejects at `now() >= registration_closes_at` (DB clock, row-locked — the authority)
2. API pre-check (`effectiveStatus`)
3. Status is derived from the clock on every read, and the public list filters on it, so an event leaves discovery at start−30 even if cron never runs. Cron/`sync_event_statuses()` only keeps the stored `status` column tidy.
Times are entered in the platform timezone (default Asia/Kolkata) and stored as UTC.

## 4. Payments (important)
Your existing architecture is manual UPI + UTR, not a gateway, so I extended that rather than add a new provider. A paid registration is created as `PENDING_PAYMENT`; the participant pays by UPI QR and submits a UTR (`SUBMITTED`); **only the event's organizer/admin confirming it server-side** makes it `CONFIRMED` and reveals the QR pass. The browser can never confirm. Display labels map to your requested states: PAYMENT_REQUIRED / PAYMENT_PROCESSING / PAID / PAYMENT_FAILED / CANCELLED.
If you later add Razorpay, implement `PaymentProvider` in `lib/providers/payment-provider.ts` and have its webhook perform the same `SUBMITTED→CONFIRMED` update.

## 5. Security notes
- QR = `/check-in/<256-bit random token>` — no personal data. Token is shown to the participant only once `CONFIRMED`.
- Every organizer/admin API re-derives the caller from the session and checks ownership (`loadOwnedEvent`); client-sent eventId/userId are never trusted. Scan checks: token valid → registration exists → belongs to this event → payment confirmed → not checked in → organizer owns event.
- Duplicate check-in is impossible at DB level (`check_ins.registration_id UNIQUE`); duplicate registration blocked in `register_for_event()`.
- Participant answers are returned only by owner/admin routes. Public APIs expose no participant data, organizer email, or UPI details (UPI only to the registrant who must pay).
- New tables have RLS enabled with no client policies (service-role only). Migration also tightens the old `events` select policy to owner-only (the public list goes through `/api/events`).
- Same-origin check on all mutating routes, rate limits on register/scan/check-in/upload/export (in-memory — swap for Redis if you run multiple instances), magic-byte poster validation, CSV formula-injection guard, phone masked on the scanner screen.

## 6. Verified
- `vitest`: 20 new tests (cutoff boundary at exactly 5:30 PM for a 6 PM event, timezone, status transitions, dynamic validation) — all pass with the existing 5.
- `tsc` clean and `next build` succeeds.
- Migration run twice on a real Postgres (PGlite) with your 0006 schema: idempotent, legacy rows backfilled; registration confirmed, duplicate rejected, capacity enforced, post-deadline rejected, duplicate check-in blocked, status sync correct.

## 7. NOT verified (needs your Supabase project / real devices)
End-to-end browser flows against live Supabase, real camera scanning on phones (needs HTTPS or localhost), poster upload to the `event-posters` bucket, and visual/responsive review. Please click through: create college event → publish → register as a second user → (paid) submit UTR → confirm as organizer → scan → re-scan.

## 8. Limitations
- Export is CSV (UTF-8 BOM, opens in Excel); no native .xlsx.
- Organizer email notifications are in-app (`notifications` table), since the app has no outbound mail yet.
- After people register, an event's price/type and fields are locked; schedule is locked once started.
- Old admin-created-event pages (`/admin/events/new` and its APIs) were replaced by the new flow; legacy events keep working.

## 9. Files to DELETE from your existing project (replaced by the new flow)
- `app/admin/events/new/page.tsx`
- `app/api/admin/events/route.ts`
- `app/api/admin/events/[id]/route.ts`
(`app/api/admin/events/registrations/[regId]/route.ts` stays; it still works for legacy events.)
