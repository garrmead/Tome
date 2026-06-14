import { createClient } from "@/lib/supabase/server"
import type {
  SearchFile,
  SearchFilters,
  SearchLine,
  SearchManufacturer,
  SearchProduct,
  SearchResults,
} from "./types"

function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&")
}

function isShort(term: string): boolean {
  return term.length < 3
}

export async function searchAll(rawTerm: string): Promise<SearchResults> {
  const term = rawTerm.trim()
  if (!term) {
    return { manufacturers: [], lines: [], products: [], files: [], orgMap: {} }
  }

  const supabase = await createClient()
  const escaped = escapeLike(term)
  const pattern = `%${escaped}%`

  const [mfrsRes, linesRes, productsRes, filesRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, logo_url")
      .eq("type", "manufacturer")
      .ilike("name", pattern)
      .limit(5),

    supabase
      .from("product_lines")
      .select("id, name, description, manufacturer_org_id")
      .ilike("name", pattern)
      .limit(5),

    isShort(term)
      ? supabase
          .from("products")
          .select(
            "id, model_number, name, category, manufacturer_org_id, product_line_id"
          )
          .ilike("name", pattern)
          .limit(5)
      : supabase
          .from("products")
          .select(
            "id, model_number, name, category, manufacturer_org_id, product_line_id"
          )
          .textSearch("search_vector", term, {
            type: "websearch",
            config: "english",
          })
          .limit(5),

    isShort(term)
      ? supabase
          .from("files")
          .select(
            "id, filename, file_type, file_size, product_id, owner_org_id, product_line_id"
          )
          .ilike("filename", pattern)
          .limit(5)
      : supabase
          .from("files")
          .select(
            "id, filename, file_type, file_size, product_id, owner_org_id, product_line_id"
          )
          .textSearch("search_vector", term, {
            type: "websearch",
            config: "english",
          })
          .limit(5),
  ])

  const manufacturers = (mfrsRes.data ?? []) as SearchManufacturer[]
  const lines = (linesRes.data ?? []) as SearchLine[]
  const products = (productsRes.data ?? []) as SearchProduct[]
  const files = (filesRes.data ?? []) as SearchFile[]

  // Batch-load org metadata for result enrichment.
  const orgIds = [
    ...new Set([
      ...lines.map((l) => l.manufacturer_org_id),
      ...products.map((p) => p.manufacturer_org_id),
      ...files.map((f) => f.owner_org_id),
    ]),
  ]

  const orgMap: Record<string, { name: string; slug: string }> = {}

  for (const m of manufacturers) {
    orgMap[m.id] = { name: m.name, slug: m.slug }
  }

  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .in("id", orgIds)

    for (const org of (orgs ?? []) as any[]) {
      if (!orgMap[org.id]) orgMap[org.id] = { name: org.name, slug: org.slug }
    }
  }

  return { manufacturers, lines, products, files, orgMap }
}

export async function searchProducts(
  rawTerm: string,
  filters: { manufacturerId?: string; category?: string },
  limit = 20
): Promise<SearchProduct[]> {
  const supabase = await createClient()
  const term = rawTerm.trim()
  const pattern = `%${escapeLike(term)}%`

  let q = supabase
    .from("products")
    .select("id, model_number, name, category, manufacturer_org_id, product_line_id")

  if (term) {
    q = isShort(term)
      ? q.ilike("name", pattern)
      : q.textSearch("search_vector", term, {
          type: "websearch",
          config: "english",
        })
  }

  if (filters.manufacturerId) q = q.eq("manufacturer_org_id", filters.manufacturerId)
  if (filters.category) q = q.eq("category", filters.category)

  const { data } = await q.order("model_number").limit(limit)
  return (data ?? []) as SearchProduct[]
}

export async function searchFiles(
  rawTerm: string,
  filters: { manufacturerId?: string; fileType?: string },
  limit = 20
): Promise<SearchFile[]> {
  const supabase = await createClient()
  const term = rawTerm.trim()
  const pattern = `%${escapeLike(term)}%`

  let q = supabase
    .from("files")
    .select(
      "id, filename, file_type, file_size, product_id, owner_org_id, product_line_id"
    )

  if (term) {
    q = isShort(term)
      ? q.ilike("filename", pattern)
      : q.textSearch("search_vector", term, {
          type: "websearch",
          config: "english",
        })
  }

  if (filters.manufacturerId) q = q.eq("owner_org_id", filters.manufacturerId)
  if (filters.fileType) q = q.eq("file_type", filters.fileType)

  const { data } = await q.order("filename").limit(limit)
  return (data ?? []) as SearchFile[]
}

export async function getSearchFilters(): Promise<SearchFilters> {
  const supabase = await createClient()

  const [catsRes, mfrsRes] = await Promise.all([
    supabase.from("products").select("category").not("category", "is", null),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("type", "manufacturer")
      .order("name"),
  ])

  const categories = [
    ...new Set((catsRes.data ?? []).map((r: any) => r.category as string)),
  ].sort()
  const manufacturers = (mfrsRes.data ?? []) as { id: string; name: string }[]

  return { categories, manufacturers }
}

export async function getDashboardStats(
  orgType: "manufacturer" | "distributor",
  orgId: string
): Promise<Record<string, number>> {
  const supabase = await createClient()

  if (orgType === "manufacturer") {
    const [lines, products, files, grants] = await Promise.all([
      supabase
        .from("product_lines")
        .select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("files").select("id", { count: "exact", head: true }),
      supabase
        .from("access_grants")
        .select("id", { count: "exact", head: true })
        .eq("manufacturer_org_id", orgId)
        .is("revoked_at", null),
    ])
    return {
      lines: lines.count ?? 0,
      products: products.count ?? 0,
      files: files.count ?? 0,
      grants: grants.count ?? 0,
    }
  } else {
    const [mfrs, products] = await Promise.all([
      supabase
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("type", "manufacturer"),
      supabase.from("products").select("id", { count: "exact", head: true }),
    ])
    return {
      manufacturers: mfrs.count ?? 0,
      products: products.count ?? 0,
    }
  }
}
