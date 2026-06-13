"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/auth/get-user"

import type { Org, Profile } from "@/lib/auth/get-user"
import type { User } from "@supabase/supabase-js"

type ActionResult<T = void> = { error: string } | { data: T }

type ManufacturerContext =
  | { ok: false; error: string }
  | { ok: true; user: User; profile: Profile; org: Org }

async function requireManufacturer(): Promise<ManufacturerContext> {
  const { user, profile, org } = await getUser()
  if (!user || !profile || !org) {
    return { ok: false, error: "Not authenticated" }
  }
  if (org.type !== "manufacturer") {
    return { ok: false, error: "Only manufacturers can manage a catalog" }
  }
  return { ok: true, user, profile, org }
}

export async function createProductLine(
  input: { name: string; description?: string }
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const name = input.name?.trim()
  if (!name) return { error: "Name is required" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_lines")
    .insert({
      manufacturer_org_id: ctx.org.id,
      name,
      description: input.description?.trim() || null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath("/catalog")
  return { data: { id: data.id } }
}

export async function updateProductLine(
  id: string,
  input: { name: string; description?: string }
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const name = input.name?.trim()
  if (!name) return { error: "Name is required" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("product_lines")
    .update({ name, description: input.description?.trim() || null })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath(`/catalog/lines/${id}`)
  revalidatePath("/catalog")
  return { data: undefined }
}

export async function createProduct(
  input: {
    product_line_id: string
    model_number: string
    name: string
    category?: string
  }
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const model_number = input.model_number?.trim()
  const name = input.name?.trim()
  if (!model_number || !name) {
    return { error: "Model number and name are required" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .insert({
      product_line_id: input.product_line_id,
      manufacturer_org_id: ctx.org.id,
      model_number,
      name,
      category: input.category?.trim() || null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/catalog/lines/${input.product_line_id}`)
  return { data: { id: data.id } }
}

export async function updateProduct(
  id: string,
  input: {
    model_number: string
    name: string
    category?: string
    description?: string
    specs?: Record<string, unknown>
  }
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const model_number = input.model_number?.trim()
  const name = input.name?.trim()
  if (!model_number || !name) {
    return { error: "Model number and name are required" }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("products")
    .update({
      model_number,
      name,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      specs: input.specs ?? {},
    })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath(`/catalog/products/${id}`)
  return { data: undefined }
}

export async function addProductTag(
  productId: string,
  tagName: string
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const name = tagName?.trim().toLowerCase()
  if (!name) return { error: "Tag name is required" }

  const supabase = await createClient()

  // Upsert the tag, then link it. Tags are global (unique name).
  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single()

  if (tagError) return { error: tagError.message }

  const { error: linkError } = await supabase
    .from("product_tags")
    .insert({ product_id: productId, tag_id: tag.id })

  // Ignore duplicate-link errors; surface anything else.
  if (linkError && linkError.code !== "23505") {
    return { error: linkError.message }
  }

  revalidatePath(`/catalog/products/${productId}`)
  return { data: undefined }
}

export async function removeProductTag(
  productId: string,
  tagId: string
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("product_tags")
    .delete()
    .eq("product_id", productId)
    .eq("tag_id", tagId)

  if (error) return { error: error.message }
  revalidatePath(`/catalog/products/${productId}`)
  return { data: undefined }
}

export async function registerUploadedFile(
  input: {
    product_id: string
    product_line_id: string | null
    filename: string
    storage_path: string
    file_type: string
    file_size: number
  }
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("files")
    .insert({
      product_id: input.product_id,
      owner_org_id: ctx.org.id,
      product_line_id: input.product_line_id,
      filename: input.filename,
      storage_path: input.storage_path,
      file_type: input.file_type,
      file_size: input.file_size,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/catalog/products/${input.product_id}`)
  return { data: { id: data.id } }
}

export async function deleteFile(
  fileId: string,
  storagePath: string,
  productId: string
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()

  // Remove the storage object first; the row is the source of truth for the UI.
  await supabase.storage.from("product-files").remove([storagePath])

  const { error } = await supabase.from("files").delete().eq("id", fileId)
  if (error) return { error: error.message }

  revalidatePath(`/catalog/products/${productId}`)
  return { data: undefined }
}
