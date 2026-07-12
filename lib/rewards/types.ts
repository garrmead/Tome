export interface RewardProgram {
  id: string
  manufacturer_org_id: string
  name: string
  description: string | null
  active: boolean
}

export interface RewardTier {
  id: string
  program_id: string
  tier_index: number
  name: string
  threshold_gmv: number
  reward_title: string
  reward_description: string | null
  reward_image_url: string | null
}

export interface RewardProgress {
  current_gmv: number
  current_tier_index: number
}

export interface LeaderboardRow {
  user_id: string
  full_name: string
  current_gmv: number
  current_tier_index: number
  is_me: boolean
}

export interface RewardEarning {
  id: string
  event_type: "tier_crossed" | "sale_logged" | "reward_claimed"
  tier_index: number | null
  gmv_delta: number | null
  created_at: string
}

/** Everything the Hub needs to render the rewards layer for one manufacturer. */
export interface RewardsState {
  program: RewardProgram
  tiers: RewardTier[]
  progress: RewardProgress
  leaderboard: LeaderboardRow[]
  activity: RewardEarning[]
  claimedTierIndexes: number[]
}

export interface LogSaleResult {
  previous_gmv: number
  new_gmv: number
  previous_tier_index: number
  new_tier_index: number
}
