"use server"

import { createClient } from "@/lib/supabase/server"
import type { Contact, ManufacturerProfile } from "@/lib/profile/types"
import type { ProductFile, ProductLine } from "@/lib/catalog/types"
import type { HubLine, HubManufacturerData } from "@/lib/hub/types"

type Result<T> = { error: string } | { data: T }

/**
 * Load everything the hub needs to populate the four tabs for a single
 * manufacturer: product lines (with files), contacts, pricebooks, cheat sheets.
 * RLS gates every query — the caller only sees what they've been granted.
 */
export async function loadManufacturerHub(
  orgId: string
): Promise<Result<HubManufacturerData>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Instrumentation: a rep opening a manufacturer's hub is the core
  // engagement signal for analytics. Best-effort.
  await supabase.rpc("log_event", {
    p_manufacturer_org_id: orgId,
    p_event_type: "hub_view",
  })

  const [
    { data: profile },
    { data: lines },
    { data: products },
    { data: files },
  ] = await Promise.all([
    supabase
      .from("manufacturer_profiles")
      .select("logo_url, tagline, contacts")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("product_lines")
      .select("*")
      .eq("manufacturer_org_id", orgId)
      .order("name"),
    supabase
      .from("products")
      .select("id, product_line_id")
      .eq("manufacturer_org_id", orgId),
    supabase
      .from("files")
      .select("*")
      .eq("owner_org_id", orgId)
      .order("created_at", { ascending: false }),
  ])

  const productsByLine = new Map<string, string[]>()
  for (const p of (products ?? []) as { id: string; product_line_id: string }[]) {
    if (!productsByLine.has(p.product_line_id)) {
      productsByLine.set(p.product_line_id, [])
    }
    productsByLine.get(p.product_line_id)!.push(p.id)
  }

  const allFiles = (files as ProductFile[]) ?? []
  const filesByProduct = new Map<string, ProductFile[]>()
  for (const f of allFiles) {
    if (!f.product_id) continue
    if (!filesByProduct.has(f.product_id)) filesByProduct.set(f.product_id, [])
    filesByProduct.get(f.product_id)!.push(f)
  }

  const hubLines: HubLine[] = ((lines as ProductLine[]) ?? []).map((line) => {
    const productIds = productsByLine.get(line.id) ?? []
    const lineFiles: ProductFile[] = []
    for (const pid of productIds) {
      const fs = filesByProduct.get(pid)
      if (fs) lineFiles.push(...fs)
    }
    // Also include files attached directly to the line (line-level files).
    for (const f of allFiles) {
      if (f.product_line_id === line.id && !f.product_id) lineFiles.push(f)
    }
    return {
      ...line,
      product_count: productIds.length,
      file_count: lineFiles.length,
      files: lineFiles,
    }
  })

  const mfrProfile = (profile as Pick<
    ManufacturerProfile,
    "logo_url" | "tagline" | "contacts"
  > | null) ?? null

  const contacts: Contact[] = Array.isArray(mfrProfile?.contacts)
    ? mfrProfile!.contacts
    : []

  const pricebooks = allFiles.filter((f) => f.file_type === "pricebook")
  const cheatsheets = allFiles.filter(
    (f) => f.file_type === "brochure" || f.file_type === "other"
  )

  return {
    data: {
      lines: hubLines,
      contacts,
      pricebooks,
      cheatsheets,
      logo_url: mfrProfile?.logo_url ?? null,
      tagline: mfrProfile?.tagline ?? null,
    },
  }
}

/** Mark every unread notification for the caller as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("recipient_user_id", user.id)
}
