import { redirect } from "next/navigation"
import { BarChart3, Download, Eye, Building2, PhoneCall } from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import {
  getActiveGranteeOrgs,
  getFileRefs,
  getRecentEvents,
  type AnalyticsEvent,
} from "@/lib/analytics/queries"
import {
  Card,
  CardContent,
  CardDescription,
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

const ACCENT = "#2f6ea3"

// ── Aggregation helpers (pure TS, no SQL views) ────────────────────────────

function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

function lastNDayKeys(n: number): string[] {
  const keys: string[] = []
  const now = Date.now()
  for (let i = n - 1; i >= 0; i--) {
    keys.push(new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  }
  return keys
}

const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
})

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

interface OrgEngagement {
  orgId: string
  name: string
  downloads: number
  previews: number
  hubViews: number
  lastActive: string // ISO timestamp
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const { org } = await getUser()
  if (org?.type !== "manufacturer") redirect("/dashboard")

  const [events, files, granteeOrgs] = await Promise.all([
    getRecentEvents(),
    getFileRefs(),
    getActiveGranteeOrgs(),
  ])

  const orgNames = new Map(granteeOrgs.map((o) => [o.id, o.name]))
  const fileNames = new Map(files.map((f) => [f.id, f.filename]))

  // Stat cards
  const count = (type: AnalyticsEvent["event_type"]) =>
    events.filter((e) => e.event_type === type).length
  const downloads = count("file_download")
  const previews = count("file_preview")
  const hubVisits = count("hub_view")
  const activeOrgIds = new Set(
    events
      .map((e) => e.actor_org_id)
      .filter((id): id is string => Boolean(id) && id !== org.id)
  )

  // Activity — last 14 days
  const dayKeys = lastNDayKeys(14)
  const perDay = new Map(dayKeys.map((k) => [k, 0]))
  for (const e of events) {
    const key = utcDayKey(e.created_at)
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const maxPerDay = Math.max(1, ...perDay.values())

  // Engagement by distributor
  const engagement = new Map<string, OrgEngagement>()
  for (const e of events) {
    if (!e.actor_org_id || e.actor_org_id === org.id) continue
    let row = engagement.get(e.actor_org_id)
    if (!row) {
      row = {
        orgId: e.actor_org_id,
        name: orgNames.get(e.actor_org_id) ?? "Unknown organization",
        downloads: 0,
        previews: 0,
        hubViews: 0,
        lastActive: e.created_at,
      }
      engagement.set(e.actor_org_id, row)
    }
    if (e.event_type === "file_download") row.downloads++
    else if (e.event_type === "file_preview") row.previews++
    else if (e.event_type === "hub_view") row.hubViews++
    if (e.created_at > row.lastActive) row.lastActive = e.created_at
  }
  const engagementRows = [...engagement.values()].sort(
    (a, b) =>
      b.downloads + b.previews + b.hubViews - (a.downloads + a.previews + a.hubViews)
  )

  // Top files (previews + downloads)
  const fileCounts = new Map<string, { previews: number; downloads: number }>()
  for (const e of events) {
    if (
      (e.event_type !== "file_preview" && e.event_type !== "file_download") ||
      !e.subject_id
    )
      continue
    const row = fileCounts.get(e.subject_id) ?? { previews: 0, downloads: 0 }
    if (e.event_type === "file_preview") row.previews++
    else row.downloads++
    fileCounts.set(e.subject_id, row)
  }
  const topFiles = [...fileCounts.entries()]
    .map(([fileId, c]) => ({
      fileId,
      filename: fileNames.get(fileId) ?? "Deleted file",
      ...c,
      total: c.previews + c.downloads,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Dormant grantees — active grant, zero events in 30 days
  const dormant = granteeOrgs.filter((o) => !activeOrgIds.has(o.id))

  const stats = [
    { label: "Downloads (30d)", value: downloads, icon: Download },
    { label: "Previews (30d)", value: previews, icon: Eye },
    { label: "Hub visits (30d)", value: hubVisits, icon: BarChart3 },
    {
      label: "Active distributor orgs (30d)",
      value: activeOrgIds.size,
      icon: Building2,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          How distributors engage with your catalog over the last 30 days.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No activity yet</p>
              <p className="text-sm text-muted-foreground">
                Events appear when distributors open your catalog in the Hub.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Activity bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Activity — last 14 days</CardTitle>
              <CardDescription>
                All events per day: previews, downloads, hub visits, searches,
                and RFQs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2" style={{ height: 160 }}>
                {dayKeys.map((key) => {
                  const value = perDay.get(key) ?? 0
                  const date = new Date(`${key}T00:00:00Z`)
                  return (
                    <div
                      key={key}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                      title={`${dateFmt.format(date)}: ${value} event${value === 1 ? "" : "s"}`}
                    >
                      <div
                        className="w-full max-w-8 rounded-t"
                        style={{
                          backgroundColor: value > 0 ? ACCENT : undefined,
                          height:
                            value > 0
                              ? `${Math.max(4, (value / maxPerDay) * 100)}%`
                              : 2,
                          ...(value === 0 && {
                            backgroundColor: "hsl(var(--muted-foreground) / 0.25)",
                          }),
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {weekdayFmt.format(date)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Engagement by distributor */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement by distributor</CardTitle>
                <CardDescription>
                  Sorted by total activity in the last 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {engagementRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No distributor activity yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Distributor</TableHead>
                        <TableHead className="text-right">Downloads</TableHead>
                        <TableHead className="text-right">Previews</TableHead>
                        <TableHead className="text-right">Hub visits</TableHead>
                        <TableHead className="text-right">Last active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {engagementRows.map((row) => (
                        <TableRow key={row.orgId}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.downloads}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.previews}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.hubViews}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {dateFmt.format(new Date(row.lastActive))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top files */}
            <Card>
              <CardHeader>
                <CardTitle>Top files</CardTitle>
                <CardDescription>
                  Most previewed and downloaded files, last 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topFiles.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No file activity yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="text-right">Previews</TableHead>
                        <TableHead className="text-right">Downloads</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topFiles.map((f) => (
                        <TableRow key={f.fileId}>
                          <TableCell className="max-w-52 truncate font-medium">
                            {f.filename}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {f.previews}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {f.downloads}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {f.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dormant grantees */}
          {dormant.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <PhoneCall className="h-4 w-4" />
                  Dormant grantees
                </CardTitle>
                <CardDescription>
                  These organizations hold an active access grant but haven&apos;t
                  engaged recently.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {dormant.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
                    >
                      <span className="font-medium">{o.name}</span>
                      <span className="text-muted-foreground">
                        No activity in 30 days — worth a call.
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
