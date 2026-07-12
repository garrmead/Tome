# Tome — Project Status

_Last updated: 2026-07-12_

## What Tome is

Tome is a B2B catalog-sharing platform. Manufacturers publish their product
catalogs — product lines, products, specs, and files like datasheets, price
books, and IOMs — and selectively grant distributors access to all or part of
that catalog. Distributors browse the manufacturers they've been granted access
to through a full-screen **Hub** console, search across everything, and preview
PDFs in the browser. Access is controlled granularly, down to a single product
line, product, file, or specific user within a distributor org.

**Stack:** Next.js 14 (App Router, TypeScript), Tailwind + shadcn/ui, Supabase
(Postgres + RLS + Storage + Auth), TanStack Query, React Hook Form + Zod,
react-pdf, sonner.

---

## Current state: **working demo**

The application builds clean (`tsc --noEmit` and `next build` both pass) and is
usable end-to-end via the no-login demo flow. It is a functional prototype /
demo, not yet production-hardened.

### How to run / log in
- There is **no password login** in the demo. Go to `/demo` and click
  **Enter as Distributor** or **Enter as Manufacturer**.
- Behind the scenes this resets the account password via the admin API and signs
  you in for real, so **RLS still applies** exactly as in production.
- Once in, the account switcher in the top bar flips between the two roles.

### ⚠️ Demo data must be loaded manually
The demo **content** (product lines, files, contacts, price books, cheat sheets)
lives in two SQL files that must be run in the Supabase SQL Editor — this is a
manual step and is **not** done automatically:

1. `supabase/seed.sql` — orgs, product lines, ~30 products, sample grants
2. `supabase/seed_hub_mock.sql` — profiles with contacts, ~50 line-level files,
   price books, cheat sheets

The `enterDemo` flow creates the **access grants** automatically, but not the
catalog content above. Verify what's loaded:

```sql
SELECT 'organizations' AS tbl, count(*) FROM organizations
UNION ALL SELECT 'product_lines', count(*) FROM product_lines
UNION ALL SELECT 'files',         count(*) FROM files
UNION ALL SELECT 'access_grants', count(*) FROM access_grants;
-- Expected: organizations 4, product_lines 6, files ≥50, access_grants ≥2
```

> Note: seed file rows are metadata only — no actual PDF bytes are uploaded to
> Storage, so clicking "Open" on a seeded file will fail at the signed-URL step.
> That's expected for the demo.

---

## What's built

### Manufacturer surfaces (`app/(app)/`)
- `/catalog` — manage product lines and products
- `/catalog/lines/[id]`, `/catalog/products/[id]` — line & product detail
- `/access` — grant/revoke distributor access (granular scopes)
- `/profile` — public-facing profile (logo, about, contacts, org chart)
- `/dashboard`, `/search`

### Distributor surfaces
- `/hub` — the full-screen Hub console (`app/(hub)/`, its own full-bleed layout):
  manufacturer rail, four tabs (Lines / Contacts / Price Sheets / Cheat Sheets),
  inline PDF viewer, Cmd-K search, notification bell
- `/browse` — accessible manufacturers
- `/m/[slug]` — public manufacturer pages
- `/search` — search across accessible catalogs

### Backend
- 4 migrations in `supabase/migrations/` (schema, schema align, RLS policies,
  manufacturer profile fields)
- RLS enforced on every distributor query via `SECURITY DEFINER` helpers
  (`has_manufacturer_access`, `has_product_access`, `has_file_access`) at both
  the Postgres and Storage layer
- `access_grants` scope model: `all` / `product_line` / `product` / `file`,
  org-level or user-level, with `revoked_at` / `expires_at`

---

## Recent work (this branch: `claude/eager-meitner-onu1p0`)

| Commit | What |
|---|---|
| `cecfa09` | Hub responsiveness: per-manufacturer client cache, route-level loading skeleton, retryable error states, parallel signed-URL fetches, `getUser` wrapped in React `cache()`, `Promise.all` on server waterfalls |
| `4156c29` | Fixed silent failures in `enterDemo` (supabase-js returns errors, never throws — the try/catch was dead code); errors now logged; revoked grants reactivated instead of colliding with the unique constraint |
| `3014750` | Load PDF viewer lazily (`next/dynamic`, `ssr: false`) to avoid a pdfjs load-time crash |
| `49102d9` | Make demo entry robust to a half-cleaned auth schema |
| `44b7dc8` | No-login demo switcher + restyle Hub to match design handoff |

---

## Known limitations / not yet done

- **No real file bytes in Storage for seeded data** — previews/downloads of
  seeded files fail (metadata-only seed).
- **Password login unused** — demo flow only. A real auth/onboarding path exists
  in code (`/login`, `/signup`) but isn't the primary entry.
- **Specials & notifications are mocked** (`lib/hub/specials.ts`) — the Hub UI is
  wired to them, but they aren't backed by Postgres yet.
- **No bulk catalog ingestion** — manufacturers add products/files one at a time.
- **No analytics, RFQ, or rewards** — see roadmap below.

---

## Roadmap (recommended build order)

The keystone is a single append-only **`events`** table (every view, search,
download). Notifications, analytics, and rewards are all projections of it, and
every file open already funnels through one server action (`getFileSignedUrl`) —
the natural instrumentation chokepoint.

1. **Phase 1 — Instrument + make mocks real (quick win).** Add `events` table +
   logging; promote mocked Specials/Notifications to real Postgres tables. The
   Hub UI is already wired for this.
2. **Phase 2 — Analytics + bulk ingestion.** "Who's viewing what" for
   manufacturers (justifies them paying); CSV/file bulk import so a
   3,000-SKU manufacturer can onboard in an hour.
3. **Phase 3 — Rewards.** Per-manufacturer points programs: distributors earn
   points (new price-book downloads, new-product views, RFQ activity) toward
   each manufacturer's own reward catalog. Ledger-based, server-side-only writes,
   idempotency keys + daily caps for anti-abuse, manufacturer-funded budgets.
   This is the intended business moat (redeemable only inside Tome = switching
   costs).
4. **Phase 4 — RFQ / Request-a-Quote.** Capture buying intent that currently
   leaks to email; wires into notifications, analytics, and rewards.

---

## Key files

- `components/hub/data-hub.tsx` — the core distributor console (~1,000 lines)
- `app/(hub)/hub/actions.ts` — `loadManufacturerHub()` (batched line/product/file fetch)
- `lib/distributor/queries.ts` — `getAccessibleManufacturers()`
- `lib/distributor/actions.ts` — `getFileSignedUrl()` (the instrumentation chokepoint)
- `lib/auth/actions.ts` — `enterDemo()` demo entry
- `lib/auth/demo.ts` — demo identities
- `lib/hub/specials.ts` — mocked specials/notifications (to be promoted to Postgres)
- `supabase/migrations/` — schema + RLS
- `supabase/seed.sql`, `supabase/seed_hub_mock.sql` — demo data (run manually)
