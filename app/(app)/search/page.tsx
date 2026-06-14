import Link from "next/link"
import {
  Building2,
  FileText,
  List,
  Package,
  Search,
} from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import {
  getSearchFilters,
  searchAll,
  searchFiles,
  searchProducts,
} from "@/lib/search/queries"
import { FILE_TYPE_LABELS, type FileType } from "@/lib/catalog/types"
import type { OrgMeta, SearchResults } from "@/lib/search/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { FilterSidebar } from "@/components/search/filter-sidebar"

interface Props {
  searchParams: {
    q?: string
    type?: string
    mfr?: string
    cat?: string
    ft?: string
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function seeAllUrl(q: string, type: string): string {
  return `/search?q=${encodeURIComponent(q)}&type=${type}`
}

// ── Overview (all groups, top 5 each) ────────────────────────────────────────

function OverviewResults({
  q,
  results,
  orgType,
}: {
  q: string
  results: SearchResults
  orgType?: string
}) {
  const { manufacturers, lines, products, files, orgMap } = results
  const total =
    manufacturers.length + lines.length + products.length + files.length

  if (total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Search className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No results for &ldquo;{q}&rdquo;</p>
            <p className="text-sm text-muted-foreground">
              Try different keywords or a shorter phrase.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {manufacturers.length > 0 && (
        <ResultSection
          label="Manufacturers"
          icon={<Building2 className="h-4 w-4" />}
          seeAllHref={seeAllUrl(q, "manufacturer")}
          seeAllLabel={`See all manufacturer results`}
        >
          {manufacturers.map((m) => (
            <ResultCard
              key={m.id}
              href={`/m/${m.slug}`}
              primary={m.name}
              meta={[]}
            />
          ))}
        </ResultSection>
      )}

      {lines.length > 0 && (
        <ResultSection
          label="Product Lines"
          icon={<List className="h-4 w-4" />}
          seeAllHref={seeAllUrl(q, "product_line")}
          seeAllLabel="See all product line results"
        >
          {lines.map((l) => {
            const mfr: OrgMeta | undefined = orgMap[l.manufacturer_org_id]
            const href =
              orgType === "manufacturer"
                ? `/catalog/lines/${l.id}`
                : `/m/${mfr?.slug ?? ""}/lines/${l.id}`
            return (
              <ResultCard
                key={l.id}
                href={href}
                primary={l.name}
                meta={[mfr?.name].filter(Boolean) as string[]}
              />
            )
          })}
        </ResultSection>
      )}

      {products.length > 0 && (
        <ResultSection
          label="Products"
          icon={<Package className="h-4 w-4" />}
          seeAllHref={seeAllUrl(q, "product")}
          seeAllLabel="See all product results"
        >
          {products.map((p) => {
            const mfr = orgMap[p.manufacturer_org_id]
            const href =
              orgType === "manufacturer"
                ? `/catalog/products/${p.id}`
                : `/m/${mfr?.slug ?? ""}/products/${p.id}`
            return (
              <ResultCard
                key={p.id}
                href={href}
                primary={p.name}
                meta={[
                  p.model_number,
                  p.category ?? undefined,
                  mfr?.name,
                ].filter(Boolean) as string[]}
              />
            )
          })}
        </ResultSection>
      )}

      {files.length > 0 && (
        <ResultSection
          label="Files"
          icon={<FileText className="h-4 w-4" />}
          seeAllHref={seeAllUrl(q, "file")}
          seeAllLabel="See all file results"
        >
          {files.map((f) => {
            const mfr = orgMap[f.owner_org_id]
            return (
              <ResultCard
                key={f.id}
                href={`/search?q=${encodeURIComponent(q)}&type=file`}
                primary={f.filename}
                meta={[
                  f.file_type
                    ? (FILE_TYPE_LABELS[f.file_type as FileType] ?? f.file_type)
                    : undefined,
                  formatSize(f.file_size),
                  mfr?.name,
                ].filter(Boolean) as string[]}
              />
            )
          })}
        </ResultSection>
      )}
    </div>
  )
}

// ── Full product results ──────────────────────────────────────────────────────

async function ProductResults({
  q,
  mfr,
  cat,
  orgType,
  orgMap,
}: {
  q: string
  mfr?: string
  cat?: string
  orgType?: string
  orgMap: Record<string, OrgMeta>
}) {
  const products = await searchProducts(q, {
    manufacturerId: mfr,
    category: cat,
  })

  if (products.length === 0) {
    return <EmptyResults q={q} />
  }

  return (
    <div className="space-y-2">
      {products.map((p) => {
        const manufacturer = orgMap[p.manufacturer_org_id]
        const href =
          orgType === "manufacturer"
            ? `/catalog/products/${p.id}`
            : `/m/${manufacturer?.slug ?? ""}/products/${p.id}`
        return (
          <ResultCard
            key={p.id}
            href={href}
            primary={p.name}
            meta={[
              p.model_number,
              p.category ?? undefined,
              manufacturer?.name,
            ].filter(Boolean) as string[]}
          />
        )
      })}
    </div>
  )
}

// ── Full file results ─────────────────────────────────────────────────────────

async function FileResults({
  q,
  mfr,
  ft,
  orgMap,
}: {
  q: string
  mfr?: string
  ft?: string
  orgMap: Record<string, OrgMeta>
}) {
  const files = await searchFiles(q, { manufacturerId: mfr, fileType: ft })

  if (files.length === 0) {
    return <EmptyResults q={q} />
  }

  return (
    <div className="space-y-2">
      {files.map((f) => {
        const mfrMeta = orgMap[f.owner_org_id]
        return (
          <ResultCard
            key={f.id}
            href={`/search?q=${encodeURIComponent(q)}&type=file&mfr=${mfr ?? ""}`}
            primary={f.filename}
            meta={[
              f.file_type
                ? (FILE_TYPE_LABELS[f.file_type as FileType] ?? f.file_type)
                : undefined,
              formatSize(f.file_size),
              mfrMeta?.name,
            ].filter(Boolean) as string[]}
          />
        )
      })}
    </div>
  )
}

// ── Shared presentational pieces ─────────────────────────────────────────────

function ResultSection({
  label,
  icon,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  label: string
  icon: React.ReactNode
  seeAllHref: string
  seeAllLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {label}
        </h2>
        <Link
          href={seeAllHref}
          className="text-xs text-primary hover:underline"
        >
          {seeAllLabel} →
        </Link>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ResultCard({
  href,
  primary,
  meta,
}: {
  href: string
  primary: string
  meta: string[]
}) {
  return (
    <Link href={href}>
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
        <span className="font-medium truncate">{primary}</span>
        {meta.length > 0 && (
          <div className="ml-4 flex shrink-0 items-center gap-2">
            {meta.map((m, i) => (
              <Badge key={i} variant="secondary">
                {m}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

function EmptyResults({ q }: { q: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Search className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-sm text-muted-foreground">
            Try different keywords or adjust the filters.
          </p>
        </div>
        <Link href={`/search?q=${encodeURIComponent(q)}`} className="text-sm text-primary hover:underline">
          ← Back to overview
        </Link>
      </CardContent>
    </Card>
  )
}

const TYPE_LABELS: Record<string, string> = {
  manufacturer: "Manufacturers",
  product_line: "Product Lines",
  product: "Products",
  file: "Files",
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q ?? ""
  const type = searchParams.type
  const { org } = await getUser()
  const orgType = org?.type

  // For full-type views, load filters + accessible manufacturers for sidebar
  const needsFilters = type === "product" || type === "file"

  const [filters, overviewResults] = await Promise.all([
    needsFilters ? getSearchFilters() : Promise.resolve(null),
    !type ? searchAll(q) : Promise.resolve(null),
  ])

  // Build an orgMap for enriching results in full views
  let orgMap: Record<string, OrgMeta> = {}
  if (filters) {
    for (const m of filters.manufacturers) {
      // slug isn't loaded here — we'll do a quick enrichment in the component
      orgMap[m.id] = { name: m.name, slug: "" }
    }
  }
  if (overviewResults) {
    orgMap = overviewResults.orgMap
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">
          {q ? (
            <>
              Results for &ldquo;<span className="text-foreground">{q}</span>&rdquo;
              {type && (
                <span className="text-muted-foreground">
                  {" "}— {TYPE_LABELS[type] ?? type}
                </span>
              )}
            </>
          ) : (
            "Search"
          )}
        </h1>
      </div>

      {!q ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Start typing in the search bar, or press{" "}
              <kbd className="rounded border px-1.5 font-mono text-xs">⌘K</kbd>
            </p>
          </CardContent>
        </Card>
      ) : !type ? (
        // Overview
        <OverviewResults q={q} results={overviewResults!} orgType={orgType} />
      ) : (
        // Full filtered view
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Sidebar */}
          {filters && (
            <aside className="md:w-56 shrink-0">
              <FilterSidebar
                type={type}
                q={q}
                currentMfr={searchParams.mfr}
                currentCat={searchParams.cat}
                currentFt={searchParams.ft}
                manufacturers={filters.manufacturers}
                categories={filters.categories}
                fileTypes={Object.entries(FILE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </aside>
          )}

          {/* Results */}
          <div className="flex-1 min-w-0">
            {type === "product" && (
              <ProductResults
                q={q}
                mfr={searchParams.mfr}
                cat={searchParams.cat}
                orgType={orgType}
                orgMap={orgMap}
              />
            )}
            {type === "file" && (
              <FileResults
                q={q}
                mfr={searchParams.mfr}
                ft={searchParams.ft}
                orgMap={orgMap}
              />
            )}
            {(type === "manufacturer" || type === "product_line") && (
              // These types don't have extra filters — just show overview for them
              overviewResults ? (
                <OverviewResults q={q} results={overviewResults} orgType={orgType} />
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  )
}
