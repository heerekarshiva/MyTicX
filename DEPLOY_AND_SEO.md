# TICX – Deploy & SEO guide

This project is the merged `ticx-updated` + `ticx-organize-event-overlay` codebase (overlay applied, the three files it
lists for deletion removed), rebuilt for production and search visibility.

## 1. Deploy (Render)

1. Push to GitHub. In Render choose **New → Blueprint** and select the repo (`render.yaml` is included).
2. Fill in the secret env vars (see `.env.example`). The important ones:
   - `NEXT_PUBLIC_APP_URL=https://www.your-domain.com` — **needed at build time** (canonicals, sitemap, social cards).
   - `APP_ENV=production` — without it `robots.txt` blocks all crawlers (deliberate, protects staging).
   - Supabase URL / anon key / service-role key, `CRON_SECRET`, `NEXT_PUBLIC_SUPPORT_EMAIL`.
3. Run the SQL in `supabase/` (schema, then migrations through `0008_event_platform.sql`).
4. Attach your custom domain (HTTPS is automatic). Redirect the non-preferred host (www vs apex) to one canonical host.
5. Health check: `GET /api/health`. Event status cron: every minute `GET /api/cron/sync-events` with `Authorization: Bearer $CRON_SECRET`.

## 2. What was added for SEO

| Area | What it does |
|---|---|
| Metadata | Title template, description, canonical, Open Graph and Twitter cards per page (`lib/seo.ts`). Canonicals are per page by design. |
| Crawl control | `robots.txt` and `sitemap.xml` generated from live data (events included, refreshed hourly). Private areas ship `noindex`; `/api/*` sends `X-Robots-Tag: noindex`. |
| Server-rendered content | `/events`, `/events/[id]`, `/marketplace` and the landing page render real HTML for crawlers (they were client-only before). |
| Structured data | Organization, WebSite + sitelinks search box, FAQPage, BreadcrumbList, ItemList, and **Event** (price, availability, dates) for every event. |
| Correct status codes | Unknown events return a real 404, not a soft 200. Filtered marketplace URLs are `noindex,follow`. |
| Content | New crawlable pages: How it works, FAQ, About, Contact, Terms, Privacy. Footer dead anchors fixed. |
| Social/brand | Generated 1200×630 share image, brand favicon/Apple icon, web manifest. |

## 3. Production hardening

HSTS, `X-Frame-Options`, `nosniff`, Referrer/Permissions policies (camera allowed for the QR scanner), `poweredByHeader` off,
error/404 pages, `/api/health`, middleware now validates sessions with `getUser()` instead of trusting the cookie,
CI (typecheck, tests, build), 30 passing unit tests, and a clean `next build`.

The Content-Security-Policy ships as **report-only**. After deploy, open the key pages with the browser console open; if there
are no violations set `CSP_ENFORCE=true`.

## 4. Getting to the top of Google (honest version)

No one can guarantee a #1 ranking: Google decides it from the whole web, and a new domain starts with no authority.
The code now removes the technical blockers. These steps are what actually move the ranking:

1. **Verify the site** in [Google Search Console](https://search.google.com/search-console) (set `GOOGLE_SITE_VERIFICATION`),
   submit `https://your-domain/sitemap.xml`, and use *URL Inspection → Request indexing* on the home page. Do the same in Bing Webmaster Tools.
2. **Brand searches ("TICX") rank first fastest.** Make sure the brand name appears consistently, create profiles
   (LinkedIn, Instagram, X, Google Business Profile if you have a place) and link them to the site.
3. **Backlinks and mentions** are the biggest factor for competitive terms like "buy movie tickets": college partnerships,
   event listings, press, directories, and organizers linking to their TICX event page.
4. **Publish useful content regularly** (city guides, "how to sell a movie ticket safely", event-organizing guides) and
   keep `/events` populated: fresh, real events are your best long-tail traffic.
5. **Speed and mobile**: run Lighthouse / PageSpeed on the live URL and compress event posters.
6. Expect weeks to months for new-domain rankings. Check Search Console → Performance to see queries and fix what you find.

## 5. Before you take real money / launch publicly

- `PAYMENT_PROVIDER` defaults to `dev_simulator`. Payments for resale are manual UPI + seller confirmation by design; confirm that is what you want to launch with.
- `lib/rate-limit.ts` is in-memory: fine for a single instance, use Redis/Upstash if you scale to several.
- Individual `/listing/[id]` pages require login (existing behaviour) so they are not indexable; this is also sensible because listings expire.
- **Terms and Privacy are plain-language templates, not legal advice.** Have a lawyer review them (including refund/dispute handling and the governing-law clause) before launch.
- Set `NEXT_PUBLIC_SUPPORT_EMAIL` so /contact shows a real address.
- Not tested here: live Supabase, real devices/camera scanning, and visual review in browsers. Click through: sign up → list → buy → create event → register → scan.

---
# Production hardening (migration 0009) — READ BEFORE GOING LIVE

## Extra setup steps
1. Run `supabase/migrations/0009_production_hardening.sql, then 0010_audit_fixes.sql` (after 0002–0008). Safe to re-run.
2. Render env: `PAYMENT_PROVIDER=phonepe`, `APP_ENV=production`. The dev payment simulator is hard-disabled in production and
   the old unauthenticated `/api/payments/webhook` route has been deleted. Manual seller-confirmed UPI routes return 404 while PhonePe is on.
3. The cron job (`/api/cron/sync-events`, every minute) now also releases expired reservations and purges rate-limit rows. Keep it running.
4. Sold-out rule (enforced in the database, not just the UI): one `for update` lock in `reserve_listing_for_purchase`, plus a unique index
   (`uq_orders_one_open_per_listing`) so a listing can never have two live orders. Once SOLD, every buy attempt gets "sold out".
5. Refunds: if a buyer pays but the ticket is already gone (or the amount differs), the app refunds via PhonePe automatically and logs it in
   `payment_issues` (see Admin → Payouts). Check that page daily; any `REFUND_FAILED` row needs a manual refund from the PhonePe dashboard.
6. Seller payouts: PhonePe pays YOU. Every paid order creates a `seller_payouts` row (ticket price). Pay sellers by UPI and mark paid in Admin → Payouts.
7. Verify in PhonePe sandbox: (a) refund call works, (b) cancel a payment mid-way, (c) pay after the reservation expired.

## SEO
- Listing pages `/listing/[id]` are public: Product + Offer JSON-LD, per-listing title/description/canonical.
  ACTIVE = indexable + InStock. Sold/reserved/expired = `noindex` + SoldOut. Active listings (max 1000) are in `/sitemap.xml`.
- Set `NEXT_PUBLIC_APP_URL` BEFORE the build, set `GOOGLE_SITE_VERIFICATION`, submit `/sitemap.xml` in Search Console.

## How many users at once? (honest numbers, not guarantees)
- Render Starter (0.5 CPU / 512 MB, 1 instance): roughly 100–300 people browsing at once, ~20–50 checkouts/minute. Browsing is cached (15 s)
  so spikes mostly hit memory, not Postgres. Buying is DB-locked per listing, so thousands of people can fight over ONE ticket safely; only one wins.
- Supabase free tier is the first thing you'll outgrow (connection limits, 500 MB, pauses after inactivity). Move to Pro before real launch.
- To grow: Render Standard (1 CPU / 2 GB) or 2 instances (rate limits are now shared via Postgres so this is safe), then Supabase Pro.
- Load test before launch: `npx autocannon -c 100 -d 30 https://YOUR-DOMAIN/marketplace` and run `tests/concurrent-purchase.md`.
