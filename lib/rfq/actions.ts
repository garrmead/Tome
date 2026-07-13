"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { RFQ_STATUSES, type RfqItemInput, type RfqStatus } from "./types"

type Result<T> = { error: string } | { data: T }

/**
 * Create an RFQ from the Hub. RLS enforces that the caller belongs to a
 * distributor org holding a grant to the manufacturer; the rfqs INSERT
 * trigger notifies the manufacturer's admins and logs an rfq_submitted event.
 */
export async function createRfq(
  manufacturerOrgId: string,
  items: RfqItemInput[],
  note: string | null
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleanItems = items.filter(
    (i) => i.product_line_id && Number.isFinite(i.quantity) && i.quantity > 0
  )
  if (cleanItems.length === 0) {
    return { error: "Add at least one product line with a quantity." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.org_id) return { error: "No organization for current user" }

  const { data: rfq, error: rfqErr } = await supabase
    .from("rfqs")
    .insert({
      distributor_org_id: profile.org_id,
      manufacturer_org_id: manufacturerOrgId,
      created_by: user.id,
      note: note?.trim() || null,
    })
    .select("id")
    .single()

  if (rfqErr || !rfq) {
    return { error: rfqErr?.message ?? "Could not create the quote request" }
  }

  const { error: itemsErr } = await supabase.from("rfq_items").insert(
    cleanItems.map((i) => ({
      rfq_id: rfq.id,
      product_line_id: i.product_line_id,
      quantity: Math.floor(i.quantity),
      note: i.note?.trim() || null,
    }))
  )

  if (itemsErr) {
    // Don't leave an empty RFQ behind.
    await supabase.from("rfqs").delete().eq("id", rfq.id)
    return { error: itemsErr.message }
  }

  return { data: { id: rfq.id } }
}

/** Manufacturer: move an RFQ through its status flow. */
export async function updateRfqStatus(
  rfqId: string,
  status: RfqStatus
): Promise<Result<true>> {
  if (!RFQ_STATUSES.includes(status)) return { error: "Invalid status" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("rfqs")
    .update({ status })
    .eq("id", rfqId)

  if (error) return { error: error.message }
  revalidatePath("/rfqs")
  return { data: true }
}
