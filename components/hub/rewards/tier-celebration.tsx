"use client"

import { useTransition } from "react"
import { Gift } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ACCENT, MONO_LABEL } from "@/components/hub/tokens"
import { claimReward } from "@/lib/rewards/actions"
import type { RewardTier } from "@/lib/rewards/types"
import { useInvalidateRewards } from "./use-rewards"

/** Milestone modal shown when a logged sale crosses a tier threshold. */
export function TierCelebration({
  tier,
  programId,
  manufacturerOrgId,
  onClose,
}: {
  tier: RewardTier | null
  programId: string
  manufacturerOrgId: string
  onClose: () => void
}) {
  const [pending, startClaim] = useTransition()
  const invalidate = useInvalidateRewards()

  function doClaim() {
    if (!tier) return
    startClaim(async () => {
      const res = await claimReward(programId, tier.tier_index)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`${tier.name} reward claim recorded`)
      invalidate(manufacturerOrgId)
      onClose()
    })
  }

  return (
    <Dialog open={!!tier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        {tier && (
          <>
            <DialogHeader>
              <DialogTitle className="font-sans text-base">
                {tier.name} tier reached
              </DialogTitle>
            </DialogHeader>

            <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {tier.reward_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tier.reward_image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Gift className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            <div>
              <p className={cn(MONO_LABEL, "mb-1")}>Your reward</p>
              <p className="font-sans text-sm font-semibold">{tier.reward_title}</p>
              {tier.reward_description && (
                <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                  {tier.reward_description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="font-mono text-xs"
              >
                Later
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={doClaim}
                className="font-mono text-xs text-white hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                {pending ? "Claiming…" : "Claim reward"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
