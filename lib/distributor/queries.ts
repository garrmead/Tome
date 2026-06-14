import { createClient } from "@/lib/supabase/server"
import type { Org } from "@/lib/auth/get-user"
import type { Contact, ManufacturerProfile } from "@/lib/profile/types"
import type { Product, ProductFile, ProductLine } from "@/lib/catalog/types"
import type { ManufacturerCard, ManufacturerView } from "./types"

// Every query below runs through the cookie-bound server client, so RLS is
// fully in force: a distributor only ever sees manufacturers, lines, products,
// and files they have an active, unrevoked grant for. There is no admin client
// anywhere in this file by design.

/**
 * Manufacturers the current user/org has active grants to.
 * The `organizations` "granted manufacturers" RLS policy already restricts the
 * rows to exactly those the caller can see, so a plain select is sufficient.
 */
export async function getAccessibleManufacturers(): Promise<ManufacturerCard[]> {
  const supabase = await createClient()

  const [{ data: orgs }, { data: products }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("*")
        .eq("type", "manufacturer")
        .order("name"),
      // RLS limits this to products the caller can actually access.
      supabase.from("products").select("manufacturer_org_id, category"),
      supabase
        .from("manufacturer_profiles")
        .select("org_id, logo_url, tagline"),
    ])

  if (!orgs || orgs.length === 0) return []

  const profileMap = new Map<string, { logo_url: string | null; tagline: string | null }>()
  for (const p of (profiles ?? []) as any[]) {
    profileMap.set(p.org_id, { logo_url: p.logo_url, tagline: p.tagline })
  }

  const countMap = new Map<string, number>()
  const catMap = new Map<string, Set<string>>()
  for (const row of (products ?? []) as any[]) {
    const mfr = row.manufacturer_org_id as string
    countMap.set(mfr, (countMap.get(mfr) ?? 0) + 1)
    if (row.category) {
      if (!catMap.has(mfr)) catMap.set(mfr, new Set())
      catMap.get(mfr)!.add(row.category as string)
    }
  }

  return (orgs as Org[]).map((org) => {
    const prof = profileMap.get(org.id)
    return {
      org,
      logo_url: prof?.logo_url ?? org.logo_url ?? null,
      tagline: prof?.tagline ?? null,
      product_count: countMap.get(org.id) ?? 0,
      categories: [...(catMap.get(org.id) ?? [])].sort(),
    }
  })
}

/** Resolve a manufacturer org by slug — RLS gates visibility. */
export async function getManufacturerOrgBySlug(
  slug: string
): Promise<Org | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .eq("type", "manufacturer")
    .maybeSingle()
  return (data as Org) ?? null
}

/** Full read-only manufacturer view (header + tab gating). */
export async function getManufacturerView(
  slug: string
): Promise<ManufacturerView | null> {
  const supabase = await createClient()

  const org = await getManufacturerOrgBySlug(slug)
  if (!org) return null

  const [{ data: profile }, { data: pricebooks }] = await Promise.all([
    supabase
      .from("manufacturer_profiles")
      .select("*")
      .eq("org_id", org.id)
      .maybeSingle(),
    // Only pricebook files the caller can see survive RLS. One is enough to
    // decide whether to surface the Price Books tab.
    supabase
      .from("files")
      .select("id")
      .eq("owner_org_id", org.id)
      .eq("file_type", "pricebook")
      .limit(1),
  ])

  const mfrProfile = (profile as ManufacturerProfile) ?? null
  const contacts: Contact[] = Array.isArray(mfrProfile?.contacts)
    ? mfrProfile!.contacts
    : []

  const show_price_books = Boolean(
    mfrProfile?.enable_price_books && (pricebooks?.length ?? 0) > 0
  )

  return { org, profile: mfrProfile, contacts, show_price_books }
}

/** Product lines for a manufacturer, with the count of visible products. */
export async function getAccessibleLines(
  mfrOrgId: string
): Promise<(ProductLine & { product_count: number })[]> {
  const supabase = await createClient()

  const [{ data: lines }, { data: products }] = await Promise.all([
    supabase
      .from("product_lines")
      .select("*")
      .eq("manufacturer_org_id", mfrOrgId)
      .order("name"),
    supabase
      .from("products")
      .select("product_line_id")
      .eq("manufacturer_org_id", mfrOrgId),
  ])

  const countMap = new Map<string, number>()
  for (const p of (products ?? []) as any[]) {
    countMap.set(p.product_line_id, (countMap.get(p.product_line_id) ?? 0) + 1)
  }

  return ((lines as ProductLine[]) ?? []).map((line) => ({
    ...line,
    product_count: countMap.get(line.id) ?? 0,
  }))
}

/** A single product line, scoped to its manufacturer. RLS gates access. */
export async function getLineForView(
  mfrOrgId: string,
  lineId: string
): Promise<ProductLine | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_lines")
    .select("*")
    .eq("id", lineId)
    .eq("manufacturer_org_id", mfrOrgId)
    .maybeSingle()
  return (data as ProductLine) ?? null
}

/** Products in a line the caller can actually see. */
export async function getProductsForLineView(
  lineId: string
): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("product_line_id", lineId)
    .order("model_number")
  return (data as Product[]) ?? []
}

/** A single product, gated by RLS (has_product_access). */
export async function getProductForView(
  productId: string
): Promise<Product | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle()
  return (data as Product) ?? null
}

/** Files attached to a product the caller can see, gated by RLS. */
export async function getProductFilesView(
  productId: string
): Promise<ProductFile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("files")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
  return (data as ProductFile[]) ?? []
}

/** Pricebook files for a manufacturer the caller can see. */
export async function getPricebookFiles(
  mfrOrgId: string
): Promise<ProductFile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("files")
    .select("*")
    .eq("owner_org_id", mfrOrgId)
    .eq("file_type", "pricebook")
    .order("filename")
  return (data as ProductFile[]) ?? []
}
