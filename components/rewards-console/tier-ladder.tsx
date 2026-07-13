"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createTier, deleteTier, updateTier } from "@/lib/rewards/manufacturer"
import type { RewardTier } from "@/lib/rewards/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const MAX_TIERS = 5

interface Props {
  programId: string
  tiers: RewardTier[]
}

function TierRow({ tier }: { tier: RewardTier }) {
  const [name, setName] = useState(tier.name)
  const [threshold, setThreshold] = useState(String(tier.threshold_gmv))
  const [rewardTitle, setRewardTitle] = useState(tier.reward_title)
  const [rewardDescription, setRewardDescription] = useState(
    tier.reward_description ?? ""
  )
  const [saving, startSave] = useTransition()
  const [deleting, startDelete] = useTransition()

  function handleSave() {
    const thresholdValue = Number(threshold)
    if (!name.trim()) {
      toast.error("Tier name is required")
      return
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
      toast.error("Threshold must be greater than zero")
      return
    }
    if (!rewardTitle.trim()) {
      toast.error("Reward title is required")
      return
    }
    startSave(async () => {
      const result = await updateTier(tier.id, {
        name,
        threshold_gmv: thresholdValue,
        reward_title: rewardTitle,
        reward_description: rewardDescription,
      })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Tier ${tier.tier_index} saved.`)
      }
    })
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteTier(tier.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Tier ${tier.tier_index} removed.`)
      }
    })
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f6ea3]/10 text-xs font-semibold text-[#2f6ea3]">
            {tier.tier_index}
          </span>
          {tier.reward_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tier.reward_image_url}
              alt=""
              className="h-6 w-6 shrink-0"
            />
          )}
          <span className="text-sm font-medium">{tier.name}</span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Delete tier ${tier.tier_index}`}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`tier-name-${tier.id}`}>Tier name</Label>
          <Input
            id={`tier-name-${tier.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tier-threshold-${tier.id}`}>Threshold (GMV, $)</Label>
          <Input
            id={`tier-threshold-${tier.id}`}
            type="number"
            min={1}
            step={1000}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tier-reward-title-${tier.id}`}>Reward title</Label>
          <Input
            id={`tier-reward-title-${tier.id}`}
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tier-reward-desc-${tier.id}`}>Reward description</Label>
          <Input
            id={`tier-reward-desc-${tier.id}`}
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save tier
        </Button>
      </div>
    </div>
  )
}

function AddTierForm({
  programId,
  nextIndex,
  onDone,
}: {
  programId: string
  nextIndex: number
  onDone: () => void
}) {
  const [name, setName] = useState("")
  const [threshold, setThreshold] = useState("")
  const [rewardTitle, setRewardTitle] = useState("")
  const [rewardDescription, setRewardDescription] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    const thresholdValue = Number(threshold)
    if (!name.trim()) {
      toast.error("Tier name is required")
      return
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
      toast.error("Threshold must be greater than zero")
      return
    }
    if (!rewardTitle.trim()) {
      toast.error("Reward title is required")
      return
    }
    startTransition(async () => {
      const result = await createTier(programId, nextIndex, {
        name,
        threshold_gmv: thresholdValue,
        reward_title: rewardTitle,
        reward_description: rewardDescription,
      })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Tier ${nextIndex} added.`)
        onDone()
      }
    })
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        New tier (position {nextIndex})
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-tier-name">Tier name</Label>
          <Input
            id="new-tier-name"
            placeholder="Platinum"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-tier-threshold">Threshold (GMV, $)</Label>
          <Input
            id="new-tier-threshold"
            type="number"
            min={1}
            step={1000}
            placeholder="250000"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-tier-reward-title">Reward title</Label>
          <Input
            id="new-tier-reward-title"
            placeholder="Factory tour for two"
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-tier-reward-desc">Reward description</Label>
          <Input
            id="new-tier-reward-desc"
            placeholder="Optional details shown to reps"
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleAdd} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add tier
        </Button>
      </div>
    </div>
  )
}

export function TierLadder({ programId, tiers }: Props) {
  const [adding, setAdding] = useState(false)
  const nextIndex =
    tiers.length > 0 ? Math.max(...tiers.map((t) => t.tier_index)) + 1 : 1
  const canAdd = tiers.length < MAX_TIERS && nextIndex <= MAX_TIERS

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tier ladder</CardTitle>
        {canAdd && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add tier
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No tiers yet. Add a tier to give reps a milestone to work toward.
          </p>
        )}
        {tiers.map((tier) => (
          <TierRow key={tier.id} tier={tier} />
        ))}
        {adding && (
          <AddTierForm
            programId={programId}
            nextIndex={nextIndex}
            onDone={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
