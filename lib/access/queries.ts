import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/auth/get-user"
import type { GrantWithDetails, ScopeType } from "./types"
import type { Product, ProductFile, ProductLine } from "@/lib/catalog/types"

export async function getActiveGrants(): Promise<GrantWithDetails[]> {
  const { org } = await getUser()
  if (!org || org.type !== "manufacturer") return []

  const admin = createAdminClient()

  // Admin client bypasses RLS — needed because the manufacturer cannot see
  // distributor org rows through the standard anon policies.
  const { data: grants } = await admin
    .from("access_grants")
    .select(
      `*, grantee_org:grantee_org_id(id, name, slug),
       grantee_user_profile:grantee_user_id(id, full_name),
       grantor_profile:granted_by(id, full_name)`
    )
    .eq("manufacturer_org_id", org.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  if (!grants || grants.length === 0) return []

  // Batch-resolve scope labels for non-'all' rows.
  const lineIds = unique(scopeIds(grants, "product_line"))
  const productIds = unique(scopeIds(grants, "product"))
  const fileIds = unique(scopeIds(grants, "file"))

  const [lines, products, files] = await Promise.all([
    lineIds.length
      ? admin.from("product_lines").select("id, name").in("id", lineIds)
      : { data: [] as { id: string; name: string }[] },
    productIds.length
      ? admin
          .from("products")
          .select("id, model_number, name")
          .in("id", productIds)
      : { data: [] as { id: string; model_number: string; name: string }[] },
    fileIds.length
      ? admin.from("files").select("id, filename").in("id", fileIds)
      : { data: [] as { id: string; filename: string }[] },
  ])

  const lineMap = toMap(lines.data ?? [], "id", (l) => l.name)
  const productMap = toMap(
    products.data ?? [],
    "id",
    (p) => `${p.model_number} – ${p.name}`
  )
  const fileMap = toMap(files.data ?? [], "id", (f) => f.filename)

  return grants.map((g: any) => ({
    ...g,
    scope_label: resolveLabel(
      g.scope_type as ScopeType,
      g.scope_id,
      lineMap,
      productMap,
      fileMap
    ),
  })) as GrantWithDetails[]
}

// ── Data for the grant wizard ──────────────────────────────────────────────

/** Manufacturer's own product lines — accessible via RLS */
export async function getMfgProductLines(): Promise<ProductLine[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_lines")
    .select("*")
    .order("name")
  return (data as ProductLine[]) ?? []
}

/** Manufacturer's own products, optionally filtered by line */
export async function getMfgProducts(lineId?: string): Promise<Product[]> {
  const supabase = await createClient()
  let q = supabase.from("products").select("*").order("model_number")
  if (lineId) q = q.eq("product_line_id", lineId)
  const { data } = await q
  return (data as Product[]) ?? []
}

/** Manufacturer's own files, optionally filtered by product */
export async function getMfgFiles(productId?: string): Promise<ProductFile[]> {
  const supabase = await createClient()
  let q = supabase.from("files").select("*").order("filename")
  if (productId) q = q.eq("product_id", productId)
  const { data } = await q
  return (data as ProductFile[]) ?? []
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scopeIds(grants: any[], type: ScopeType): string[] {
  return grants
    .filter((g) => g.scope_type === type && g.scope_id)
    .map((g) => g.scope_id as string)
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)]
}

function toMap<T>(
  arr: T[],
  key: keyof T,
  val: (item: T) => string
): Record<string, string> {
  return Object.fromEntries(arr.map((item) => [item[key], val(item)]))
}

function resolveLabel(
  type: ScopeType,
  id: string | null,
  lineMap: Record<string, string>,
  productMap: Record<string, string>,
  fileMap: Record<string, string>
): string {
  if (type === "all") return "Entire catalog"
  if (!id) return type
  if (type === "product_line") return `Line: ${lineMap[id] ?? id}`
  if (type === "product") return `Product: ${productMap[id] ?? id}`
  if (type === "file") return `File: ${fileMap[id] ?? id}`
  return type
}
