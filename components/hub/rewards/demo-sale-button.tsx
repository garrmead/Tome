"use client"

import { useState, useTransition } from "react"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ACCENT, MONO_LABEL } from "@/components/hub/tokens"
import { logDemoSale } from "@/lib/rewards/actions"
import type { RewardsState, RewardTier } from "@/lib/rewards/types"
import { useInvalidateRewards } from "./use-rewards"

/**
 * Dev-only floating trigger to simulate a sale against the selected
 * manufacturer's rewards program. Rendered only when
 * NEXT_PUBLIC_DEMO_MODE=true — the check lives in the parent.
 */
export function DemoSaleButton({
  state,
  manufacturerOrgId,
  onTierCrossed,
}: {
  state: RewardsState
  manufacturerOrgId: string
  onTierCrossed: (tier: RewardTier) => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [pending, startLog] = useTransition()
  const invalidate = useInvalidateRewards()

  function submit() {
    const value = Number(amount.replace(/[$,\s]/g, ""))
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a sale amount greater than zero.")
      return
    }
    startLog(async () => {
      const res = await logDemoSale(state.program.id, value)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setAmount("")
      setOpen(false)
      invalidate(manufacturerOrgId)

      const { previous_tier_index, new_tier_index } = res.data
      if (new_tier_index > previous_tier_index) {
        const tier = state.tiers.find((t) => t.tier_index === new_tier_index)
        if (tier) {
          toast.success(`You've reached the ${tier.name} tier`)
          onTierCrossed(tier)
          return
        }
      }
      toast.success(`Logged ${value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} sale`)
    })
  }

  return (
    <div className="fixed bottom-5 right-5 z-30">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="border-dashed font-mono text-xs shadow-md"
          >
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
            Log Demo Sale
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-64 p-3.5">
          <p className={cn(MONO_LABEL, "mb-2")}>
            Simulate a {state.program.name} sale
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="GMV amount, e.g. 25000"
              inputMode="numeric"
              className="h-8 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              disabled={pending}
              onClick={submit}
              className="font-mono text-xs text-white hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              {pending ? "…" : "Log"}
            </Button>
          </div>
          <p className={cn(MONO_LABEL, "mt-2 text-[9px]")}>
            Demo control — writes to reward_earnings
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
