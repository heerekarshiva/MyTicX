# TICX (TicketSwap codebase)

> **Production rebuild:** see [`DEPLOY_AND_SEO.md`](./DEPLOY_AND_SEO.md) for deployment, SEO setup, hardening and the pre-launch checklist. The events platform from `ORGANIZE_EVENT.md` is merged in.


**Buy • Sell • Enjoy** — a secure secondary marketplace for movie tickets.

> ⚠️ **Build status: core slice, not the full spec.** This repository implements the highest-value, hardest-to-get-right parts of a much larger specification end-to-end (real code, not mockups): auth, movie search, the seller verification pipeline (including duplicate-file and duplicate-booking detection), dynamic/flat-rule pricing, phone OTP, in-app buyer/seller chat, buyer/seller consent logging, and — most importantly — **atomic, race-condition-safe ticket purchasing**. Admin tooling, fraud scoring, a full notification system, and a production payment/provider integration are stubbed with clear interfaces and TODOs so they're straightforward to build out next. See "What's stubbed" below.

---

## 1. Overview

A user who bought a movie ticket but can't use it can list it for resale at a
discount. Another user can browse, verify, and buy it. TicketSwap's job is to
make that safe: the same ticket can never be sold twice, sellers can't
misrepresent what they're selling, buyers know exactly what "verified" means,
and every purchase either fully succeeds or fully fails — never half of one.

## 2. Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, React, Tailwind CSS, Framer-Motion-ready, Lucide icons
- **Backend:** Supabase (Postgres, Auth, Storage), Row Level Security, a Postgres function for atomic purchases
- **Validation:** Zod · **Forms:** React Hook Form
- **Deployment:** Render-compatible, environment-variable configured

## 3. Architecture at a glance

```
app/                    Next.js routes (pages + API routes)
  (auth)/               login, signup, forgot/reset password
  home, search, movie/  browsing & discovery
  sell/                 6-step seller flow (details → upload → verify → price → phone → publish)
  marketplace, listing/ resale browsing + purchase + in-app chat
  my-tickets, my-listings, profile, notifications, admin/
  api/                  route handlers — the actual server-side authority
components/             UI building blocks (ui/ primitives + feature components)
lib/
  supabase/             client.ts (browser), server.ts (SSR/session), admin.ts (service role — NEVER import client-side)
  providers/            movie-provider.ts, payment-provider.ts — swappable adapters
  ticket/               fingerprint.ts, verification.ts — the verification pipeline
  config/pricing.ts     all pricing rules, in one place
supabase/schema.sql     tables, RLS policies, the atomic purchase function
```

### The concurrency-safe purchase, specifically

Two buyers clicking "Buy" on the same listing within milliseconds is the
scenario this app is built around. `app/api/purchase/route.ts` calls the
Postgres function `reserve_listing_for_purchase` (see `supabase/schema.sql`),
which:

1. Takes a `SELECT ... FOR UPDATE` row lock on the listing.
2. Under concurrency, the second call **blocks** until the first transaction
   commits, then re-reads the now-updated status and correctly raises
   `LISTING_NOT_AVAILABLE`.
3. Everything (listing status, ticket status, order creation) happens in one
   transaction, so there's no window where two orders can both exist for one
   ticket.
4. Is idempotent via an `idempotency_key`, so a retried request from a flaky
   client never double-books.

This is the real backstop behind "only one buyer wins" — not a frontend
disable-the-button trick.

### Duplicate-ticket protection (two layers)

1. **Booking-ID fingerprint** (`lib/ticket/fingerprint.ts`): a hash of
   provider + booking reference + seat, enforced by a partial unique index
   (`uq_tickets_fingerprint_active`) so the same real-world ticket can't be
   uploaded twice under different phrasing.
2. **File-content hash** (`app/api/upload-ticket/route.ts`): a SHA-256 of the
   exact uploaded PDF/image bytes, enforced by `uq_tickets_file_hash_active`,
   so the same screenshot can't be re-submitted under a *different* booking
   ID either. (This catches exact re-uploads; it does not catch a
   deliberately re-compressed or re-photographed copy — a production system
   would add perceptual hashing / OCR cross-checks for that.)

Both checks happen server-side with a real database constraint as the final
backstop — never trusting client-side logic alone.

### Pricing rule

Configured centrally in `lib/config/pricing.ts`:
- Resale price must be **at least ₹50 below** the original ticket price.
- Platform fee is a flat **₹10–15**, shown to the buyer as a separate line
  item, never hidden in the ticket price.

### Consent & dispute record

Before publishing a listing or completing a purchase, the seller/buyer sees
an explicit terms modal (`components/ConsentModal.tsx`) — the seller
acknowledges they won't reuse/resell the ticket after it sells; the buyer
acknowledges they're buying a resold ticket at their own risk and that
TicketSwap facilitates but isn't a party to the transaction. Acceptance is
logged server-side to the `consents` table with a timestamp, so there's an
evidentiary record if a fraud/refund dispute is raised later.

### In-app chat

`components/ChatThread.tsx` + `app/api/messages/route.ts` give buyers and
sellers a simple, Instagram-DM-style thread scoped to one listing. Phone
numbers are never auto-shared through this channel. RLS restricts every read
to the two participants regardless of what the API route does.

## 4. What's stubbed (and how to extend it)

| Area | Status | Extend by |
|---|---|---|
| Movie/show data | Mock provider with 3 sample shows | Implement `MovieProvider` in `lib/providers/movie-provider.ts` for a real box-office/cinema API |
| Payments | Dev simulator, no real money moves | Implement `PaymentProvider` in `lib/providers/payment-provider.ts` (Razorpay/Stripe), with real webhook signature verification |
| Phone OTP | Live — Supabase Auth's built-in email OTP (free) | For real SMS instead of email, replace the `signInWithOtp`/`verifyOtp` calls in `app/api/phone/*` with a paid SMS provider (Twilio/MSG91) |
| Admin dashboard | Read-only queue view | Add approve/reject/suspend actions as `/api/admin/*` routes, service-role only, with a server-side role check |
| Fraud scoring | `fraud_state` column exists, unused | Add signal collection (repeat uploads, rapid listings) and a job that flips `NORMAL → REVIEW → BLOCKED` |
| Provider-verified tickets | Always shows `DOCUMENT_VERIFIED` (mock provider has no live status) | Once a real `MovieProvider`/cinema partner API exists, add a status check step that can set `PROVIDER_VERIFIED` |
| Tests | Unit tests for pricing/fingerprint; concurrency test documented as an integration test | See `tests/concurrent-purchase.md` |

**No logo file was supplied with this build.** `components/Logo.tsx` renders
a typographic + gradient ticket-glyph mark instead. Drop a real logo at
`public/logo.svg` and swap the inline `<svg>` in `Logo.tsx` for an `<img>` to
brand the navbar, favicon, and login/loading screens from one place.

## 5. Database setup (Supabase)

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql` (this also creates the
   private `ticket-uploads` Storage bucket and its policies — no separate
   dashboard click-through needed), then optionally `supabase/seed.sql` for
   sample browsing data.
3. Copy your project URL, anon key, and service role key into `.env.local`
   (see `.env.example`).
4. For phone verification: Authentication -> Email Templates -> "Magic
   Link" -> add `{{ .Token }}` to the template body (see `.env.example`).

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill in real values. Never commit
`.env.local`. `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the
client — it's only read in files explicitly marked `server-only`.

## 7. Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. The mock movie provider ships 3 sample shows
in Hyderabad ("Paradise", "Orbit Rising", "Monsoon Diaries") so search works
without any external API key.

## 8. Testing

```bash
npm run test
```

Runs unit tests for pricing rules and ticket fingerprinting. The concurrent
double-purchase scenario is documented as a manual/integration test in
`tests/concurrent-purchase.md` (it needs a real Postgres connection to
demonstrate row-locking under genuine concurrency).

## 9. Deployment (Render)

- **Build command:** `npm run build`
- **Start command:** `npm run start`
- Set all variables from `.env.example` in Render's environment settings.
- `npm run start` respects `$PORT`, which Render sets automatically.

## 10. Security notes

- All privileged operations (verification, listing creation, purchase,
  payment finalization, phone OTP) run through server-side route handlers
  using the Supabase **service role** client — never the browser.
- Row Level Security is enabled on every user-data table; policies restrict
  reads/writes to the owning user or transaction participants. Payments and
  phone OTP records are not directly client-readable at all.
- Ticket files live in a **private** Storage bucket; nothing serves a raw
  ticket file or QR/barcode to the public.
- Purchases are protected by a transactional, row-locked Postgres function
  plus an idempotency key — never a frontend-only check.
- File uploads are validated by real MIME magic-bytes (not just the
  declared content-type), size-limited, and content-hashed to block
  duplicate submissions.
- A minimal in-memory rate limiter guards the messaging endpoint against
  spam (`lib/rate-limit.ts`); swap in Redis/Upstash for a multi-instance
  deployment.

## 11. Production checklist

- [ ] Real `MovieProvider` connected
- [ ] Real `PaymentProvider` connected with webhook signature verification
- [x] Phone verification — Supabase Auth email OTP (see `.env.example` for the one-time dashboard setup: add `{{ .Token }}` to the email template, optionally attach custom SMTP for volume)
- [x] Storage bucket ("ticket-uploads") created and policies applied via `schema.sql` / `migrations/0004_ticket_uploads_bucket.sql`
- [ ] Admin actions implemented with server-side role checks
- [ ] Rate limiting backed by a shared store (not in-memory) if scaling beyond one instance
- [ ] Load-test the purchase endpoint under real concurrency
- [ ] Legal review of the consent/terms text in `ConsentModal.tsx`
#   M y T i c X  
 