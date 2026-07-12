"use client"

import { useEffect, useRef, useState } from "react"
import { Gift } from "lucide-react"

import { cn } from "@/lib/utils"
import { ACCENT, ACCENT_SOFT, MONO_LABEL } from "@/components/hub/tokens"
import type { RewardsState } from "@/lib/rewards/types"
import { formatUsd, tierMath } from "./use-rewards"

/**
 * Persistent tier chip for the Hub top bar. Shows the rep's current tier with
 * the selected manufacturer, an animated progress bar toward the next tier,
 * and the dollar delta. On a tier crossing the bar sweeps through 100% before
 * resetting to the new tier's range.
 */
export function TierIndicator({ state }: { state: RewardsState }) {
  const { currentTier, nextTier, pct, deltaToNext } = tierMath(state)
  const tierIndex = state.progress.current_tier_index

  const [fill, setFill] = useState(pct)
  const [snap, setSnap] = useState(false)
  const prevTierRef = useRef(tierIndex)

  useEffect(() => {
    if (tierIndex > prevTierRef.current) {
      // Crossed a tier: sweep to 100%, snap back to 0, fill the new range.
      prevTierRef.current = tierIndex
      setFill(100)
      const t1 = setTimeout(() => {
        setSnap(true)
        setFill(0)
      }, 480)
      const t2 = setTimeout(() => {
        setSnap(false)
        setFill(pct)
      }, 540)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    prevTierRef.current = tierIndex
    setFill(pct)
  }, [tierIndex, pct])

  return (
    <div className="hidden shrink-0 items-center gap-2.5 rounded-md border bg-background px-2.5 py-1.5 lg:flex">
      <span
        className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
        style={
          currentTier
            ? { backgroundColor: ACCENT, color: "white" }
            : { backgroundColor: ACCENT_SOFT, color: ACCENT }
        }
      >
        {currentTier?.name ?? "No tier"}
      </span>

      <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${fill}%`,
            backgroundColor: ACCENT,
            transition: snap ? "none" : "width 420ms ease-out",
          }}
        />
      </div>

      <span className={cn(MONO_LABEL, "whitespace-nowrap text-[9px]")}>
        {nextTier
          ? `${formatUsd(deltaToNext)} to ${nextTier.name}`
          : "Top tier reached"}
      </span>

      {nextTier && (
        <div className="group relative flex items-center">
          <Gift className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-56 rounded-md border bg-background p-2.5 shadow-md group-hover:block">
            <p className={cn(MONO_LABEL, "mb-1")}>{nextTier.name} reward</p>
            <p className="font-sans text-xs font-medium leading-snug text-foreground">
              {nextTier.reward_title}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
