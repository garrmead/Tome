"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/auth/get-user"
import type { RewardTier } from "./types"
import type {
  ConsoleEarning,
  ConsoleProgram,
  ConsoleTotals,
  DistributorRollup,
  RewardsConsole,
} from "./manufacturer-types"

type Result<T> = { error: string } | { data: T }

const MAX_TIERS = 5

// Default artwork by ladder position; indexes past 3 have no stock image.
const TIER_IMAGES: Record<number, string> = {
  1: "/rewards/bronze.svg",
  2: "/rewards/silver.svg",
  3: "/rewards/gold.svg",
}

// Every query and write below goes through the cookie-bound server client, so
// RLS is in force: the "mfr manages own program"/"mfr manages own tiers"
// policies scope all program/tier writes to the caller's org, and the SELECT
// policies on distributor_progress / reward_earnings only expose rows for the
// caller's own program. We deliberately aggregate by distributor ORG — rep
// names in other orgs are not readable, by design.

async function requireManufacturer(): Promise<
  { ok: true; orgId: string } | { ok: false; error: string }
> {
  const { user, org } = await getUser()
  if (!user || !org) return { ok: false, error: "Not authenticated" }
  if (org.type !== "manufacturer")
    return { ok: false, error: "Only manufacturers can manage a rewards program" }
  return { ok: true, orgId: org.id }
}

// ── Console read ────────────────────────────────────────────────────────────

export async function getManufacturerRewardsConsole(): Promise<
  Result<RewardsConsole>
> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()

  const { data: program, error: programError } = await supabase
    .from("reward_programs")
    .select("id, manufacturer_org_id, name, description, active, created_at")
    .eq("manufacturer_org_id", ctx.orgId)
    .maybeSingle()

  if (programError) return { error: programError.message }

  const emptyTotals: ConsoleTotals = {
    total_gmv: 0,
    reps_enrolled: 0,
    claims_all_time: 0,
    tiers_crossed_30d: 0,
  }

  if (!program) {
    return {
      data: { program: null, tiers: [], rollup: [], activity: [], totals: emptyTotals },
    }
  }

  const programId = (program as ConsoleProgram).id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: tiers },
    { data: progressRows },
    { data: earnings },
    { count: claimsCount },
    { count: crossings30d },
  ] = await Promise.all([
    supabase
      .from("reward_tiers")
      .select(
        "id, program_id, tier_index, name, threshold_gmv, reward_title, reward_description, reward_image_url"
      )
      .eq("program_id", programId)
      .order("tier_index"),
    supabase
      .from("distributor_progress")
      .select("distributor_org_id, user_id, current_gmv, current_tier_index")
      .eq("program_id", programId),
    supabase
      .from("reward_earnings")
      .select("id, event_type, tier_index, gmv_delta, created_at, distributor_org_id")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("reward_earnings")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("event_type", "reward_claimed"),
    supabase
      .from("reward_earnings")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("event_type", "tier_crossed")
      .gte("created_at", thirtyDaysAgo),
  ])

  const progress = (progressRows ?? []) as {
    distributor_org_id: string
    user_id: string | null
    current_gmv: number
    current_tier_index: number
  }[]

  const earningRows = (earnings ?? []) as {
    id: string
    event_type: ConsoleEarning["event_type"]
    tier_index: number | null
    gmv_delta: number | null
    created_at: string
    distributor_org_id: string
  }[]

  // Resolve distributor org names in one shot. The "manufacturers can see
  // granted distributor orgs" policy covers these.
  const orgIds = Array.from(
    new Set([
      ...progress.map((r) => r.distributor_org_id),
      ...earningRows.map((r) => r.distributor_org_id),
    ])
  )
  const nameMap = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", orgIds)
    for (const o of (orgs ?? []) as { id: string; name: string }[]) {
      nameMap.set(o.id, o.name)
    }
  }

  // Group progress by distributor org: combined GMV, rep count, best tier.
  const byOrg = new Map<string, DistributorRollup>()
  for (const row of progress) {
    const existing = byOrg.get(row.distributor_org_id)
    const gmv = Number(row.current_gmv)
    if (existing) {
      existing.total_gmv += gmv
      existing.rep_count += row.user_id ? 1 : 0
      existing.best_tier_index = Math.max(existing.best_tier_index, row.current_tier_index)
    } else {
      byOrg.set(row.distributor_org_id, {
        distributor_org_id: row.distributor_org_id,
        org_name: nameMap.get(row.distributor_org_id) ?? "Distributor",
        rep_count: row.user_id ? 1 : 0,
        total_gmv: gmv,
        best_tier_index: row.current_tier_index,
      })
    }
  }
  const rollup = Array.from(byOrg.values()).sort((a, b) => b.total_gmv - a.total_gmv)

  const totals: ConsoleTotals = {
    total_gmv: progress.reduce((sum, r) => sum + Number(r.current_gmv), 0),
    reps_enrolled: progress.filter((r) => r.user_id != null).length,
    claims_all_time: claimsCount ?? 0,
    tiers_crossed_30d: crossings30d ?? 0,
  }

  const activity: ConsoleEarning[] = earningRows.map((e) => ({
    id: e.id,
    event_type: e.event_type,
    tier_index: e.tier_index,
    gmv_delta: e.gmv_delta == null ? null : Number(e.gmv_delta),
    created_at: e.created_at,
    org_name: nameMap.get(e.distributor_org_id) ?? "Distributor",
  }))

  return {
    data: {
      program: program as ConsoleProgram,
      tiers: ((tiers ?? []) as RewardTier[]).map((t) => ({
        ...t,
        threshold_gmv: Number(t.threshold_gmv),
      })),
      rollup,
      activity,
      totals,
    },
  }
}

// ── Program mutations ───────────────────────────────────────────────────────

export async function createProgram(
  name: string,
  description: string
): Promise<Result<true>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const trimmedName = name.trim()
  if (!trimmedName) return { error: "Program name is required" }

  const supabase = await createClient()
  const { error } = await supabase.from("reward_programs").insert({
    manufacturer_org_id: ctx.orgId,
    name: trimmedName,
    description: description.trim() || null,
    active: true,
  })

  if (error) {
    if (error.code === "23505")
      return { error: "Your organization already has a rewards program" }
    return { error: error.message }
  }

  revalidatePath("/rewards")
  return { data: true }
}

export async function updateProgram(
  id: string,
  patch: { name?: string; description?: string; active?: boolean }
): Promise<Result<true>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    if (!trimmed) return { error: "Program name is required" }
    update.name = trimmed
  }
  if (patch.description !== undefined) {
    update.description = patch.description.trim() || null
  }
  if (patch.active !== undefined) update.active = patch.active
  if (Object.keys(update).length === 0) return { error: "Nothing to update" }
  update.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { error } = await supabase
    .from("reward_programs")
    .update(update)
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/rewards")
  return { data: true }
}

// ── Tier mutations ──────────────────────────────────────────────────────────

function validateTierFields(fields: {
  name?: string
  threshold_gmv?: number
  reward_title?: string
}): string | null {
  if (fields.name !== undefined && !fields.name.trim())
    return "Tier name is required"
  if (
    fields.threshold_gmv !== undefined &&
    (!Number.isFinite(fields.threshold_gmv) || fields.threshold_gmv <= 0)
  )
    return "Threshold must be greater than zero"
  if (fields.reward_title !== undefined && !fields.reward_title.trim())
    return "Reward title is required"
  return null
}

export async function createTier(
  programId: string,
  tierIndex: number,
  fields: {
    name: string
    threshold_gmv: number
    reward_title: string
    reward_description?: string
  }
): Promise<Result<true>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  if (!Number.isInteger(tierIndex) || tierIndex < 1 || tierIndex > MAX_TIERS)
    return { error: `Tier position must be between 1 and ${MAX_TIERS}` }
  const invalid = validateTierFields(fields)
  if (invalid) return { error: invalid }

  const supabase = await createClient()

  const { count } = await supabase
    .from("reward_tiers")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId)
  if ((count ?? 0) >= MAX_TIERS)
    return { error: `Programs support at most ${MAX_TIERS} tiers` }

  const { error } = await supabase.from("reward_tiers").insert({
    program_id: programId,
    tier_index: tierIndex,
    name: fields.name.trim(),
    threshold_gmv: fields.threshold_gmv,
    reward_title: fields.reward_title.trim(),
    reward_description: fields.reward_description?.trim() || null,
    reward_image_url: TIER_IMAGES[tierIndex] ?? null,
  })

  if (error) {
    if (error.code === "23505")
      return { error: "A tier already exists at that position" }
    return { error: error.message }
  }

  revalidatePath("/rewards")
  return { data: true }
}

export async function updateTier(
  id: string,
  patch: {
    name?: string
    threshold_gmv?: number
    reward_title?: string
    reward_description?: string
  }
): Promise<Result<true>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const invalid = validateTierFields(patch)
  if (invalid) return { error: invalid }

  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.threshold_gmv !== undefined) update.threshold_gmv = patch.threshold_gmv
  if (patch.reward_title !== undefined) update.reward_title = patch.reward_title.trim()
  if (patch.reward_description !== undefined)
    update.reward_description = patch.reward_description.trim() || null
  if (Object.keys(update).length === 0) return { error: "Nothing to update" }

  const supabase = await createClient()
  const { error } = await supabase.from("reward_tiers").update(update).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/rewards")
  return { data: true }
}

export async function deleteTier(id: string): Promise<Result<true>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const supabase = await createClient()
  const { error } = await supabase.from("reward_tiers").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/rewards")
  return { data: true }
}
