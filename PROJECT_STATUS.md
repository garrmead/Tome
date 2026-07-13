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
The demo **content** (product lines, files, contacts, price books, cheat sheets,
rewards) lives in SQL files that must be run in the Supabase SQL Editor — this
is a manual step and is **not** done automatically:

1. `supabase/seed.sql` — orgs, product lines, ~30 products, sample grants
2. `supabase/seed_hub_mock.sql` — profiles with contacts, ~50 line-level files,
   price books, cheat sheets. **Requires the `20260712000001_rewards.sql`
   migration first** — it relaxes `files.product_id` to nullable, without which
   every line-level file insert in this seed fails.
3. `supabase/seed_rewards.sql` — Gorman-Rupp hero manufacturer (org, lines,
   contacts, grant to the demo distributor) + the Summit Rewards program
   (3 tiers, leaderboard reps, activity history)

To get **real PDF previews** for Gorman-Rupp, drop PDFs into
`demo_assets/gorman-rupp/` (see its README for the naming convention) and run
`npx tsx scripts/upload_hero_manufacturer_pdfs.ts`.

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
  manufacturer rail, five tabs (Lines / Contacts / Price Sheets / Cheat Sheets /
  Rewards), inline PDF viewer, Cmd-K search, notification bell
- **Rewards layer (rep view)** — per-manufacturer tier programs:
  - Persistent tier indicator in the Hub top bar (tier badge, animated progress
    bar, dollars-to-next-tier, reward preview on hover)
  - Rewards tab: tier ladder, reward catalog with locked/unlocked/claimed
    states, team leaderboard (own row always visible), activity feed
  - "Log Demo Sale" floating dev control (shown when
    `NEXT_PUBLIC_DEMO_MODE=true`) that bumps GMV via the `log_reward_sale`
    RPC; crossing a threshold fires a toast + celebration modal with a
    claimable reward
  - Data model: `reward_programs`, `reward_tiers`, `distributor_progress`,
    `reward_earnings` (append-only), all RLS-gated; writes only via
    SECURITY DEFINER RPCs (`log_reward_sale`, `claim_reward`)
- `/browse` — accessible manufacturers
- `/m/[slug]` — public manufacturer pages
- `/search` — search across accessible catalogs

### Backend
- 5 migrations in `supabase/migrations/` (schema, schema align, RLS policies,
  manufacturer profile fields, rewards — the last also fixes
  `files.product_id` to allow line-level files)
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
  seeded files fail (metadata-only seed) until real PDFs are uploaded via the
  hero-manufacturer script or the new Bulk Upload dialog.
- **Password login unused** — demo flow only. A real auth/onboarding path exists
  in code (`/login`, `/signup`) but isn't the primary entry.
- **Rewards earning is not yet event-derived** — sales are logged via the demo
  RPC; wiring automatic earning rules to the `events` table is future work.
- **Analytics aggregates in TypeScript** — fine at demo scale; move to SQL
  views/RPCs when event volume grows.

---

## Roadmap status

The keystone `events` table exists and every file open funnels through
`getFileSignedUrl` → `log_event`.

1. **Phase 1 — Instrumentation + real specials/notifications.** ✅ Done.
   `events` table + `log_event` RPC; file previews/downloads, hub views, and
   RFQ submissions are logged. Specials and notifications are real Postgres
   tables with trigger fan-out (new special / new price book / RFQ status
   change → per-user notifications). The Hub bell persists read state.
2. **Phase 2 — Analytics + bulk ingestion.** ✅ Done. `/analytics` (stat
   cards, 14-day activity chart, engagement by distributor, top files,
   dormant grantees) and `/catalog` bulk tools (multi-file drag-and-drop
   upload with type/line inference + review table; CSV product import with
   column mapping, specs jsonb preservation, auto-created lines).
3. **Phase 3 — Rewards.** ✅ Rep side AND manufacturer console done
   (`/rewards`: program header + pause/resume, editable tier ladder,
   distributor performance rollup, activity feed). Pending: deriving earning
   automatically from `events` instead of the demo sale RPC.
4. **Phase 4 — RFQ.** ✅ v1 done. Hub drawer (multi-line cart + notes) from
   the line header and promo strip; manufacturer `/rfqs` queue with status
   flow; notifications both directions; `rfq_submitted` logged to events.
   Future: attach quotes/pricing documents, award points on RFQ won.

---

## Key files

- `components/hub/data-hub.tsx` — the core distributor console (~1,000 lines)
- `app/(hub)/hub/actions.ts` — `loadManufacturerHub()` (batched line/product/file fetch)
- `lib/distributor/queries.ts` — `getAccessibleManufacturers()`
- `lib/distributor/actions.ts` — `getFileSignedUrl()` (the instrumentation chokepoint)
- `lib/auth/actions.ts` — `enterDemo()` demo entry
- `lib/auth/demo.ts` — demo identities
- `lib/hub/queries.ts` — live specials + notifications reads
- `lib/rewards/actions.ts` — rep-side rewards reads + RPC wrappers
- `lib/rewards/manufacturer.ts` — manufacturer rewards console actions
- `lib/rfq/actions.ts` — RFQ create + status flow
- `lib/analytics/queries.ts` — event/grant reads for `/analytics`
- `components/hub/rewards/` — tier indicator, Rewards tab, demo sale button,
  celebration modal, `useRewards` TanStack hook
- `components/hub/rfq-drawer.tsx` — Hub quote-request drawer
- `components/catalog/bulk-upload.tsx`, `components/catalog/csv-import.tsx` —
  bulk ingestion dialogs
- `scripts/upload_hero_manufacturer_pdfs.ts` — uploads real PDFs from
  `demo_assets/gorman-rupp/` into Storage + `files` rows
- `supabase/migrations/` — schema + RLS (incl. `20260712000001_rewards.sql`,
  `20260713000001_platform.sql`)
- `supabase/seed.sql`, `supabase/seed_hub_mock.sql`, `supabase/seed_rewards.sql`,
  `supabase/seed_platform.sql` — demo data (run manually, in that order)
