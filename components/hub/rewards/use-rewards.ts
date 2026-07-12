"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import { getRewardsState } from "@/lib/rewards/actions"
import type { RewardsState, RewardTier } from "@/lib/rewards/types"

export function rewardsQueryKey(manufacturerOrgId: string | null) {
  return ["rewards", manufacturerOrgId] as const
}

/** Rewards state for the selected manufacturer; null when it runs no program. */
export function useRewards(manufacturerOrgId: string | null) {
  return useQuery<RewardsState | null>({
    queryKey: rewardsQueryKey(manufacturerOrgId),
    queryFn: async () => {
      const res = await getRewardsState(manufacturerOrgId!)
      if ("error" in res) throw new Error(res.error)
      return res.data
    },
    enabled: !!manufacturerOrgId,
    staleTime: 30_000,
  })
}

export function useInvalidateRewards() {
  const queryClient = useQueryClient()
  return (manufacturerOrgId: string | null) =>
    queryClient.invalidateQueries({ queryKey: rewardsQueryKey(manufacturerOrgId) })
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

export interface TierMath {
  currentTier: RewardTier | null
  nextTier: RewardTier | null
  /** 0–100 fill within the current tier's range. 100 when maxed out. */
  pct: number
  /** Dollars remaining to the next tier. 0 when maxed out. */
  deltaToNext: number
}

/** Where the rep sits on the ladder: current tier, next tier, % progress. */
export function tierMath(state: RewardsState): TierMath {
  const { tiers, progress } = state
  const currentTier =
    tiers.find((t) => t.tier_index === progress.current_tier_index) ?? null
  const nextTier =
    tiers.find((t) => t.tier_index === progress.current_tier_index + 1) ?? null

  if (!nextTier) {
    return { currentTier, nextTier: null, pct: 100, deltaToNext: 0 }
  }

  const rangeStart = currentTier?.threshold_gmv ?? 0
  const rangeEnd = nextTier.threshold_gmv
  const span = Math.max(rangeEnd - rangeStart, 1)
  const pct = Math.min(
    100,
    Math.max(0, ((progress.current_gmv - rangeStart) / span) * 100)
  )

  return {
    currentTier,
    nextTier,
    pct,
    deltaToNext: Math.max(0, rangeEnd - progress.current_gmv),
  }
}
