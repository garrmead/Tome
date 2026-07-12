"use server"

import { createClient } from "@/lib/supabase/server"
import type {
  LeaderboardRow,
  LogSaleResult,
  RewardEarning,
  RewardProgram,
  RewardTier,
  RewardsState,
} from "./types"

type Result<T> = { error: string } | { data: T }

// Every read below runs through the cookie-bound server client, so RLS is in
// force: a rep only sees programs of manufacturers they have grants to, and
// only progress/earnings rows for their own org. Writes go through the
// SECURITY DEFINER RPCs (log_reward_sale / claim_reward) — the tables have no
// client write policies at all.
//
// NOTE: when the platform-wide `events` table lands (roadmap Phase 1), the
// earning writes move behind that chokepoint; the read shapes here stay.

/**
 * Load the full rewards state for one manufacturer, or `data: null` when the
 * manufacturer doesn't run a program (the Hub then hides the rewards layer).
 */
export async function getRewardsState(
  manufacturerOrgId: string
): Promise<Result<RewardsState | null>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: program } = await supabase
    .from("reward_programs")
    .select("id, manufacturer_org_id, name, description, active")
    .eq("manufacturer_org_id", manufacturerOrgId)
    .eq("active", true)
    .maybeSingle()

  if (!program) return { data: null }

  const programId = (program as RewardProgram).id

  const [
    { data: tiers },
    { data: progressRows },
    { data: activity },
    { data: claims },
  ] = await Promise.all([
    supabase
      .from("reward_tiers")
      .select(
        "id, program_id, tier_index, name, threshold_gmv, reward_title, reward_description, reward_image_url"
      )
      .eq("program_id", programId)
      .order("tier_index"),
    // RLS limits this to the caller's own org — exactly the leaderboard pool.
    supabase
      .from("distributor_progress")
      .select("user_id, current_gmv, current_tier_index")
      .eq("program_id", programId)
      .not("user_id", "is", null),
    supabase
      .from("reward_earnings")
      .select("id, event_type, tier_index, gmv_delta, created_at")
      .eq("program_id", programId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reward_earnings")
      .select("tier_index")
      .eq("program_id", programId)
      .eq("user_id", user.id)
      .eq("event_type", "reward_claimed"),
  ])

  const rows = (progressRows ?? []) as {
    user_id: string
    current_gmv: number
    current_tier_index: number
  }[]

  // Resolve rep names — "profiles in own org" RLS policy covers these.
  const userIds = rows.map((r) => r.user_id)
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
    for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
      nameMap.set(p.id, p.full_name)
    }
  }

  const leaderboard: LeaderboardRow[] = rows
    .map((r) => ({
      user_id: r.user_id,
      full_name: nameMap.get(r.user_id) ?? "Rep",
      current_gmv: Number(r.current_gmv),
      current_tier_index: r.current_tier_index,
      is_me: r.user_id === user.id,
    }))
    .sort((a, b) => b.current_gmv - a.current_gmv)

  const mine = rows.find((r) => r.user_id === user.id)

  return {
    data: {
      program: program as RewardProgram,
      tiers: ((tiers ?? []) as RewardTier[]).map((t) => ({
        ...t,
        threshold_gmv: Number(t.threshold_gmv),
      })),
      progress: {
        current_gmv: Number(mine?.current_gmv ?? 0),
        current_tier_index: mine?.current_tier_index ?? 0,
      },
      leaderboard,
      activity: ((activity ?? []) as RewardEarning[]).map((e) => ({
        ...e,
        gmv_delta: e.gmv_delta == null ? null : Number(e.gmv_delta),
      })),
      claimedTierIndexes: ((claims ?? []) as { tier_index: number | null }[])
        .map((c) => c.tier_index)
        .filter((t): t is number => t != null),
    },
  }
}

/** Demo-only: record a simulated sale via the log_reward_sale RPC. */
export async function logDemoSale(
  programId: string,
  amount: number
): Promise<Result<LogSaleResult>> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("log_reward_sale", {
    p_program_id: programId,
    p_gmv_delta: amount,
  })

  if (error) return { error: error.message }
  return { data: data as LogSaleResult }
}

/** Record a reward claim (fulfillment is a no-op for now). */
export async function claimReward(
  programId: string,
  tierIndex: number
): Promise<Result<true>> {
  const supabase = await createClient()

  const { error } = await supabase.rpc("claim_reward", {
    p_program_id: programId,
    p_tier_index: tierIndex,
  })

  if (error) return { error: error.message }
  return { data: true }
}
