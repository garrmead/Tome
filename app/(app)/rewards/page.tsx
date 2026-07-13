import { redirect } from "next/navigation"
import { DollarSign, Gift, TrendingUp, Users } from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import { getManufacturerRewardsConsole } from "@/lib/rewards/manufacturer"
import type {
  ConsoleEarning,
  DistributorRollup,
} from "@/lib/rewards/manufacturer-types"
import type { RewardTier } from "@/lib/rewards/types"
import { CreateProgramCard } from "@/components/rewards-console/create-program-card"
import { ProgramHeaderCard } from "@/components/rewards-console/program-header-card"
import { TierLadder } from "@/components/rewards-console/tier-ladder"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatGmv(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function tierName(tiers: RewardTier[], tierIndex: number | null): string {
  if (tierIndex == null) return "Tier"
  return tiers.find((t) => t.tier_index === tierIndex)?.name ?? `Tier ${tierIndex}`
}

function earningLabel(earning: ConsoleEarning, tiers: RewardTier[]): string {
  switch (earning.event_type) {
    case "sale_logged":
      return `${formatGmv(earning.gmv_delta ?? 0)} sale logged`
    case "tier_crossed":
      return `${tierName(tiers, earning.tier_index)} tier reached`
    case "reward_claimed":
      return `${tierName(tiers, earning.tier_index)} reward claimed`
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function DistributorTable({
  rollup,
  tiers,
}: {
  rollup: DistributorRollup[]
  tiers: RewardTier[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distributor performance</CardTitle>
      </CardHeader>
      <CardContent>
        {rollup.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No distributor activity yet. Progress appears here once reps start
            logging sales.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Distributor</TableHead>
                <TableHead className="text-right">Reps</TableHead>
                <TableHead className="text-right">Combined GMV</TableHead>
                <TableHead>Best tier reached</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollup.map((row) => (
                <TableRow key={row.distributor_org_id}>
                  <TableCell className="font-medium">{row.org_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.rep_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGmv(row.total_gmv)}
                  </TableCell>
                  <TableCell>
                    {row.best_tier_index > 0 ? (
                      <span className="text-[#2f6ea3] font-medium">
                        {tierName(tiers, row.best_tier_index)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityFeed({
  activity,
  tiers,
}: {
  activity: ConsoleEarning[]
  tiers: RewardTier[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y">
            {activity.map((earning) => (
              <li
                key={earning.id}
                className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{earning.org_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {earningLabel(earning, tiers)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(earning.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default async function RewardsPage() {
  const { org } = await getUser()

  if (org?.type !== "manufacturer") {
    redirect("/dashboard")
  }

  const result = await getManufacturerRewardsConsole()

  if ("error" in result) {
    return (
      <div className="flex justify-center mt-16">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">{result.error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { program, tiers, rollup, activity, totals } = result.data

  if (!program) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Rewards</h1>
        <CreateProgramCard />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Rewards</h1>

      <ProgramHeaderCard program={program} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total GMV tracked"
          value={formatGmv(totals.total_gmv)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Reps enrolled"
          value={totals.reps_enrolled.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Claims (all-time)"
          value={totals.claims_all_time.toLocaleString()}
          icon={<Gift className="h-4 w-4" />}
        />
        <StatCard
          label="Tier crossings (30d)"
          value={totals.tiers_crossed_30d.toLocaleString()}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <TierLadder programId={program.id} tiers={tiers} />

      <DistributorTable rollup={rollup} tiers={tiers} />

      <ActivityFeed activity={activity} tiers={tiers} />
    </div>
  )
}
