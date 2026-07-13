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

/**
 * Register a file that was uploaded to storage at product-line level
 * (no specific product — `files.product_id` is nullable).
 * The browser client performs the storage upload; this records the row.
 */
export async function registerLineFile(input: {
  product_line_id: string
  filename: string
  storage_path: string
  file_type: string
  file_size: number
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("files")
    .insert({
      product_id: null,
      product_line_id: input.product_line_id,
      owner_org_id: ctx.org.id,
      filename: input.filename,
      storage_path: input.storage_path,
      file_type: input.file_type,
      file_size: input.file_size,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/catalog/lines/${input.product_line_id}`)
  revalidatePath("/catalog")
  return { data: { id: data.id } }
}

export interface CsvProductRow {
  model_number: string
  name: string
  description?: string
  category?: string
  line_name?: string
  specs?: Record<string, string>
}

export interface ImportResult {
  inserted: number
  skipped: number
  failed: number
  createdLines: string[]
}

const INSERT_BATCH_SIZE = 100

/**
 * Bulk-import products parsed from a CSV. Resolves product lines by name
 * (case-insensitive) against the caller's existing lines, creating any that
 * are missing, then batch-inserts products. Rows missing a model number or
 * name are counted as skipped. Runs under RLS with the normal server client —
 * the "mfr manages own products" policy authorizes the inserts.
 */
export async function importProducts(
  rows: CsvProductRow[]
): Promise<ActionResult<ImportResult>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import" }
  }

  const supabase = await createClient()

  // Load the caller's existing lines (RLS scopes to their org).
  const { data: existingLines, error: linesError } = await supabase
    .from("product_lines")
    .select("id, name")
    .eq("manufacturer_org_id", ctx.org.id)
  if (linesError) return { error: linesError.message }

  const lineIdByName = new Map<string, string>()
  for (const line of existingLines ?? []) {
    lineIdByName.set(line.name.trim().toLowerCase(), line.id)
  }

  // Validate rows first so we know which line names we actually need.
  let skipped = 0
  const valid: CsvProductRow[] = []
  for (const row of rows) {
    if (!row?.model_number?.trim() || !row?.name?.trim()) {
      skipped++
      continue
    }
    valid.push(row)
  }

  // Fallback line for rows without a line name.
  const DEFAULT_LINE_NAME = "Imported Products"

  // Create any missing lines (deduped, case-insensitive).
  const createdLines: string[] = []
  const neededNames = new Map<string, string>() // lower -> display name
  for (const row of valid) {
    const display = row.line_name?.trim() || DEFAULT_LINE_NAME
    const key = display.toLowerCase()
    if (!lineIdByName.has(key) && !neededNames.has(key)) {
      neededNames.set(key, display)
    }
  }

  for (const [key, display] of neededNames) {
    const { data: created, error: createError } = await supabase
      .from("product_lines")
      .insert({ manufacturer_org_id: ctx.org.id, name: display })
      .select("id")
      .single()
    if (createError) {
      return { error: `Could not create product line "${display}": ${createError.message}` }
    }
    lineIdByName.set(key, created.id)
    createdLines.push(display)
  }

  // Build product rows and insert in batches.
  const productRows = valid.map((row) => ({
    manufacturer_org_id: ctx.org.id,
    product_line_id: lineIdByName.get(
      (row.line_name?.trim() || DEFAULT_LINE_NAME).toLowerCase()
    )!,
    model_number: row.model_number.trim(),
    name: row.name.trim(),
    description: row.description?.trim() || null,
    category: row.category?.trim() || null,
    specs: row.specs ?? {},
  }))

  let inserted = 0
  let failed = 0
  for (let i = 0; i < productRows.length; i += INSERT_BATCH_SIZE) {
    const batch = productRows.slice(i, i + INSERT_BATCH_SIZE)
    const { error: batchError } = await supabase.from("products").insert(batch)
    if (!batchError) {
      inserted += batch.length
      continue
    }
    // Batch failed (e.g. one bad row aborts the statement) — retry row by row
    // so a single bad record doesn't sink the whole batch.
    for (const row of batch) {
      const { error: rowError } = await supabase.from("products").insert(row)
      if (rowError) failed++
      else inserted++
    }
  }

  revalidatePath("/catalog")
  return { data: { inserted, skipped, failed, createdLines } }
}
