# Gorman-Rupp demo PDFs

Drop real Gorman-Rupp PDFs into this directory, then run:

```
npx tsx scripts/upload_hero_manufacturer_pdfs.ts
```

The script uploads each PDF to the `product-files` Storage bucket and
creates/updates the matching `files` row, attached at the product-line level.
Re-running is safe — files are matched by storage path and overwritten, not
duplicated.

## What to drop in

Good demo material (all publicly available from gormanrupp.com):

- **Catalog pages** — line overviews, model selection charts
- **Performance curves** — pump curves per model
- **IOMs** — installation, operation & maintenance manuals
- **Cross-references** — competitor cross-over guides
- **Dimensional drawings** — outline/installation drawings
- **Price books** — any list-price sheet (even an old one)

## Naming convention (required)

```
<line>__<type>__<Anything you like>.pdf
```

Two underscores (`__`) between each part.

**`<line>`** — which product line the file attaches to:

| prefix        | Product line              |
| ------------- | ------------------------- |
| `super-t`     | Super T Series            |
| `ultra-v`     | Ultra V Series            |
| `10-series`   | 10 Series                 |
| `reliasource` | ReliaSource Lift Stations |

**`<type>`** — one of: `datasheet`, `manual`, `cad`, `pricebook`, `iom`,
`brochure`, `other`. (`pricebook` files appear in the Hub's Price Sheets tab,
`brochure`/`other` in Cheat Sheets, the rest under their product line.)

### Examples

```
super-t__datasheet__Super_T_Series_Catalog.pdf
super-t__iom__T3A60S-B_IOM.pdf
ultra-v__datasheet__UltraV_Performance_Curves.pdf
10-series__brochure__10_Series_Quick_Reference.pdf
reliasource__manual__ReliaSource_Install_Guide.pdf
super-t__pricebook__GR_List_Prices_2026.pdf
```

Files that don't match the convention are skipped with a warning — nothing
breaks.

## Prerequisites

1. Migrations applied, including `supabase/migrations/20260712000001_rewards.sql`
2. `supabase/seed_rewards.sql` run (creates the Gorman-Rupp org + lines)
3. `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` present in
   `.env.local`
