# Tome

Tome is a B2B catalog-sharing platform that lets manufacturers publish their product catalogs — including product lines, specs, and files like datasheets and price books — and selectively grant distributors access to all or part of that catalog. Distributors can browse the manufacturers they've been granted access to, search across products and files, and preview PDFs directly in the browser. Manufacturers control access at a granular level, down to specific product lines, individual products, or single files, and can restrict access to specific users within a distributor organization. The platform also gives manufacturers a public-facing profile page with a logo, about section, contact directory, and org chart that distributors see when browsing their catalog.

## Stack

- **Framework**: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui (new-york, neutral)
- **Backend**: Supabase (Postgres + RLS + Storage + Auth)
- **Key libs**: TanStack Query, React Hook Form + Zod, react-markdown, react-pdf, sonner

## Org types

- **Manufacturer** — manages catalog (`/catalog`), grants access (`/access`), edits profile (`/profile`)
- **Distributor** — browses accessible catalogs (`/browse`), views manufacturer pages (`/m/[slug]`), searches everything (`/search`)

## Env vars required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_DEMO_MODE   # "true" shows the Log Demo Sale control in the Hub
```

## Migrations (apply in order)

```
supabase/migrations/20260613000001_schema.sql
supabase/migrations/20260613000002_schema_align.sql
supabase/migrations/20260613000003_rls_policies.sql
supabase/migrations/20260613000004_manufacturer_profile_fields.sql
supabase/migrations/20260712000001_rewards.sql
```

Seed data (run in order): `supabase/seed.sql` (demo accounts, 30 products,
sample grants), `supabase/seed_hub_mock.sql` (Hub mock files/contacts),
`supabase/seed_rewards.sql` (Gorman-Rupp hero manufacturer + Summit Rewards
program). Real Gorman-Rupp PDFs: drop into `demo_assets/gorman-rupp/` and run
`npx tsx scripts/upload_hero_manufacturer_pdfs.ts`.
