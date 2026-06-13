import { createClient } from "@/lib/supabase/server"
import type { Product, ProductFile, ProductLine, Tag } from "./types"

export async function getProductLines(): Promise<ProductLine[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_lines")
    .select("*")
    .order("name")
  return (data as ProductLine[]) ?? []
}

export async function getProductLine(
  id: string
): Promise<ProductLine | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_lines")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  return (data as ProductLine) ?? null
}

export async function getProductsForLine(
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

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  return (data as Product) ?? null
}

export async function getProductTags(productId: string): Promise<Tag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("product_tags")
    .select("tags(id, name)")
    .eq("product_id", productId)
  return ((data ?? []).map((row: any) => row.tags) as Tag[]).filter(Boolean)
}

export async function getProductFiles(
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
