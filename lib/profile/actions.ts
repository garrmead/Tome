"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/auth/get-user"
import type { Org, Profile } from "@/lib/auth/get-user"
import type { User } from "@supabase/supabase-js"
import type { Contact, ManufacturerProfile } from "./types"

type ActionResult<T = void> = { error: string } | { data: T }

type ManufacturerCtx =
  | { ok: false; error: string }
  | { ok: true; user: User; profile: Profile; org: Org }

async function requireManufacturer(): Promise<ManufacturerCtx> {
  const { user, profile, org } = await getUser()
  if (!user || !profile || !org) return { ok: false, error: "Not authenticated" }
  if (org.type !== "manufacturer")
    return { ok: false, error: "Only manufacturers have a profile to edit" }
  return { ok: true, user, profile, org }
}

export async function getManufacturerProfile(): Promise<ManufacturerProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) return null

  const { data } = await supabase
    .from("manufacturer_profiles")
    .select("*")
    .eq("org_id", profile.org_id)
    .maybeSingle()

  return data as ManufacturerProfile | null
}

export async function upsertManufacturerProfile(input: {
  tagline?: string
  about?: string
  contact_email?: string
  contact_phone?: string
  contacts?: Contact[]
  enable_price_books?: boolean
}): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("manufacturer_profiles")
    .upsert(
      {
        org_id: ctx.org.id,
        tagline: input.tagline?.trim() ?? null,
        about: input.about?.trim() ?? null,
        contact_email: input.contact_email?.trim() ?? null,
        contact_phone: input.contact_phone?.trim() ?? null,
        contacts: input.contacts ?? [],
        enable_price_books: input.enable_price_books ?? false,
      },
      { onConflict: "org_id" }
    )

  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { data: undefined }
}

/** Called from the client after a successful Storage upload */
export async function updateLogoUrl(url: string): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("manufacturer_profiles")
    .upsert({ org_id: ctx.org.id, logo_url: url }, { onConflict: "org_id" })

  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { data: undefined }
}

/** Called from the client after a successful org-chart Storage upload */
export async function updateOrgChartUrl(url: string): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("manufacturer_profiles")
    .upsert(
      { org_id: ctx.org.id, org_chart_url: url },
      { onConflict: "org_id" }
    )

  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { data: undefined }
}
