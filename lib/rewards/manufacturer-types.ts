import type { RewardProgram, RewardTier } from "./types"

/** Program row as the manufacturer console sees it (includes created_at). */
export type ConsoleProgram = RewardProgram & { created_at: string }

/** Per-distributor-org rollup of progress rows. */
export interface DistributorRollup {
  distributor_org_id: string
  org_name: string
  rep_count: number
  total_gmv: number
  best_tier_index: number
}

/** One earnings event, resolved to a distributor org name (never a rep name). */
export interface ConsoleEarning {
  id: string
  event_type: "tier_crossed" | "sale_logged" | "reward_claimed"
  tier_index: number | null
  gmv_delta: number | null
  created_at: string
  org_name: string
}

export interface ConsoleTotals {
  total_gmv: number
  reps_enrolled: number
  claims_all_time: number
  tiers_crossed_30d: number
}

/** Everything the manufacturer rewards console needs for one render. */
export interface RewardsConsole {
  program: ConsoleProgram | null
  tiers: RewardTier[]
  rollup: DistributorRollup[]
  activity: ConsoleEarning[]
  totals: ConsoleTotals
}
