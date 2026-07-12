"use client"

import { useState, useTransition } from "react"
import { Check, Gift, Lock, TrendingUp, Trophy } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ACCENT, ACCENT_SOFT, MONO_LABEL } from "@/components/hub/tokens"
import { claimReward } from "@/lib/rewards/actions"
import type { LeaderboardRow, RewardEarning, RewardsState, RewardTier } from "@/lib/rewards/types"
import { formatUsd, tierMath, useInvalidateRewards } from "./use-rewards"

function formatWhen(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function RewardsTab({
  state,
  manufacturerName,
  manufacturerOrgId,
}: {
  state: RewardsState
  manufacturerName: string
  manufacturerOrgId: string
}) {
  const { tiers, progress, leaderboard, activity, program } = state

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[980px] flex-col gap-6">
        {/* Program header */}
        <div>
          <p className={cn(MONO_LABEL, "mb-1")}>
            {manufacturerName} · rewards program
          </p>
          <h2 className="font-sans text-[17px] font-semibold">{program.name}</h2>
          {program.description && (
            <p className="mt-1 max-w-2xl font-sans text-xs leading-relaxed text-muted-foreground">
              {program.description}
            </p>
          )}
        </div>

        <TierLadder state={state} />

        {/* Reward catalog */}
        <section>
          <p className={cn(MONO_LABEL, "mb-2.5")}>Reward catalog</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <RewardCard
                key={tier.id}
                tier={tier}
                unlocked={progress.current_tier_index >= tier.tier_index}
                claimed={state.claimedTierIndexes.includes(tier.tier_index)}
                programId={program.id}
                manufacturerOrgId={manufacturerOrgId}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Leaderboard rows={leaderboard} tiers={tiers} />
          <ActivityFeed activity={activity} tiers={tiers} manufacturerName={manufacturerName} />
        </div>
      </div>
    </div>
  )
}

/** Horizontal tier ladder with an overall fill track. */
function TierLadder({ state }: { state: RewardsState }) {
  const { tiers, progress } = state
  const { nextTier, pct, deltaToNext } = tierMath(state)

  // Overall track fill: completed tier segments plus progress within the
  // current segment, with tiers spaced evenly along the track.
  const segments = tiers.length
  const done = Math.min(progress.current_tier_index, segments)
  const overall =
    segments === 0
      ? 0
      : Math.min(100, ((done + (nextTier ? pct / 100 : 0)) / segments) * 100)

  return (
    <section className="rounded-md border bg-background p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className={MONO_LABEL}>Tier progress</p>
        <p className={cn(MONO_LABEL, "text-foreground")}>
          YTD GMV {formatUsd(progress.current_gmv)}
          {nextTier && <> · {formatUsd(deltaToNext)} to {nextTier.name}</>}
        </p>
      </div>

      <div className="relative mx-2 mt-1">
        <div className="h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${overall}%`,
              backgroundColor: ACCENT,
              transition: "width 420ms ease-out",
            }}
          />
        </div>
        <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${tiers.length}, 1fr)` }}>
          {tiers.map((tier) => {
            const reached = progress.current_tier_index >= tier.tier_index
            return (
              <div key={tier.id} className="flex flex-col items-end text-right">
                <div className="-mt-[26px] mb-2 flex h-4 w-4 items-center justify-center self-end rounded-full border-2 bg-background"
                  style={{ borderColor: reached ? ACCENT : "hsl(var(--border))" }}
                >
                  {reached && (
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                  )}
                </div>
                <span
                  className={cn(
                    "font-sans text-xs",
                    reached ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {tier.name}
                </span>
                <span className={cn(MONO_LABEL, "text-[9px]")}>
                  {formatUsd(tier.threshold_gmv)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function RewardCard({
  tier,
  unlocked,
  claimed,
  programId,
  manufacturerOrgId,
}: {
  tier: RewardTier
  unlocked: boolean
  claimed: boolean
  programId: string
  manufacturerOrgId: string
}) {
  const invalidate = useInvalidateRewards()
  const [pending, startClaim] = useTransition()
  const [justClaimed, setJustClaimed] = useState(false)

  function doClaim() {
    startClaim(async () => {
      const res = await claimReward(programId, tier.tier_index)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setJustClaimed(true)
      toast.success(`${tier.name} reward claim recorded`)
      invalidate(manufacturerOrgId)
    })
  }

  const isClaimed = claimed || justClaimed

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-md border bg-background",
        !unlocked && "opacity-70"
      )}
    >
      <div className="flex h-[110px] items-center justify-center border-b bg-muted/40">
        {tier.reward_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tier.reward_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Gift className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-center justify-between">
          <span
            className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={
              unlocked
                ? { backgroundColor: ACCENT, color: "white" }
                : { backgroundColor: ACCENT_SOFT, color: ACCENT }
            }
          >
            {tier.name}
          </span>
          {unlocked ? (
            <span className={cn(MONO_LABEL, "flex items-center gap-1 text-[9px]")} style={{ color: ACCENT }}>
              <Check className="h-3 w-3" /> Unlocked
            </span>
          ) : (
            <span className={cn(MONO_LABEL, "flex items-center gap-1 text-[9px]")}>
              <Lock className="h-3 w-3" /> Locked · {formatUsd(tier.threshold_gmv)}
            </span>
          )}
        </div>
        <p className="font-sans text-[13px] font-semibold leading-snug">
          {tier.reward_title}
        </p>
        {tier.reward_description && (
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            {tier.reward_description}
          </p>
        )}
        {unlocked && (
          <Button
            size="sm"
            disabled={isClaimed || pending}
            onClick={doClaim}
            className="mt-auto self-start font-mono text-xs text-white hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {isClaimed ? "Claimed" : pending ? "Claiming…" : "Claim reward"}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Top 5 reps at this distributor; the caller's row is always visible. */
function Leaderboard({
  rows,
  tiers,
}: {
  rows: LeaderboardRow[]
  tiers: RewardTier[]
}) {
  const tierName = (idx: number) =>
    tiers.find((t) => t.tier_index === idx)?.name ?? "—"

  const myIndex = rows.findIndex((r) => r.is_me)
  let visible: { row: LeaderboardRow; rank: number }[]
  if (myIndex >= 0 && myIndex >= 5) {
    visible = [
      ...rows.slice(0, 4).map((row, i) => ({ row, rank: i + 1 })),
      { row: rows[myIndex], rank: myIndex + 1 },
    ]
  } else {
    visible = rows.slice(0, 5).map((row, i) => ({ row, rank: i + 1 }))
  }

  return (
    <section>
      <p className={cn(MONO_LABEL, "mb-2.5 flex items-center gap-1.5")}>
        <Trophy className="h-3 w-3" /> Leaderboard · your team
      </p>
      <div className="overflow-hidden rounded-md border bg-background">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No activity on this program yet.
          </p>
        ) : (
          visible.map(({ row, rank }, i) => (
            <div
              key={row.user_id}
              className={cn("flex items-center gap-3 px-3.5 py-2.5", i > 0 && "border-t")}
              style={row.is_me ? { backgroundColor: ACCENT_SOFT } : undefined}
            >
              <span className={cn(MONO_LABEL, "w-5 text-foreground")}>{rank}</span>
              <span className="flex-1 truncate font-sans text-[12px] font-medium">
                {row.full_name}
                {row.is_me && (
                  <span className={cn(MONO_LABEL, "ml-1.5 text-[9px]")} style={{ color: ACCENT }}>
                    you
                  </span>
                )}
              </span>
              <span
                className="rounded-[3px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={
                  row.current_tier_index > 0
                    ? { color: ACCENT, borderColor: ACCENT }
                    : { color: "hsl(var(--muted-foreground))" }
                }
              >
                {tierName(row.current_tier_index)}
              </span>
              <span className={cn(MONO_LABEL, "w-20 text-right text-foreground")}>
                {formatUsd(row.current_gmv)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function ActivityFeed({
  activity,
  tiers,
  manufacturerName,
}: {
  activity: RewardEarning[]
  tiers: RewardTier[]
  manufacturerName: string
}) {
  const tierName = (idx: number | null) =>
    tiers.find((t) => t.tier_index === idx)?.name ?? "tier"

  function describe(e: RewardEarning): string {
    switch (e.event_type) {
      case "sale_logged":
        return `Logged ${formatUsd(e.gmv_delta ?? 0)} ${manufacturerName} sale`
      case "tier_crossed":
        return `Reached ${tierName(e.tier_index)} tier`
      case "reward_claimed":
        return `Claimed ${tierName(e.tier_index)} reward`
    }
  }

  return (
    <section>
      <p className={cn(MONO_LABEL, "mb-2.5 flex items-center gap-1.5")}>
        <TrendingUp className="h-3 w-3" /> Recent activity
      </p>
      <div className="overflow-hidden rounded-md border bg-background">
        {activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No activity yet. Logged sales will show up here.
          </p>
        ) : (
          activity.map((e, i) => (
            <div
              key={e.id}
              className={cn("flex items-center gap-3 px-3.5 py-2.5", i > 0 && "border-t")}
            >
              <div
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    e.event_type === "tier_crossed" ? ACCENT : "hsl(var(--border))",
                }}
              />
              <span className="flex-1 truncate font-sans text-[12px]">
                {describe(e)}
              </span>
              <span className={cn(MONO_LABEL, "text-[9px]")}>
                {formatWhen(e.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
