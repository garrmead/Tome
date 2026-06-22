"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  Bell,
  Search,
  ChevronRight,
  Download,
  UserRound,
  Network,
  ExternalLink,
  X,
  FileText,
  Loader2,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ManufacturerCard } from "@/lib/distributor/types"
import type {
  HubLine,
  HubManufacturerData,
  HubNotification,
  Special,
} from "@/lib/hub/types"
import { applyEligibleLines } from "@/lib/hub/specials"
import { loadManufacturerHub } from "@/app/(app)/hub/actions"
import { FileViewer } from "@/components/distributor/file-viewer"
import { getFileSignedUrl } from "@/lib/distributor/actions"

interface Props {
  manufacturers: ManufacturerCard[]
  specials: Special[]
  notifications: HubNotification[]
  contextLabel: string
}

type TabKey = "lines" | "contacts" | "pricebooks" | "cheatsheets"

const TABS: { key: TabKey; label: string }[] = [
  { key: "lines", label: "Product Lines" },
  { key: "contacts", label: "Contact List" },
  { key: "pricebooks", label: "Price Sheets" },
  { key: "cheatsheets", label: "Cheat Sheets" },
]

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function DataHub({
  manufacturers,
  specials: initialSpecials,
  notifications: initialNotifs,
  contextLabel,
}: Props) {
  const [selectedMfrId, setSelectedMfrId] = useState<string | null>(
    manufacturers[0]?.org.id ?? null
  )
  const [tab, setTab] = useState<TabKey>("lines")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const [railFilter, setRailFilter] = useState("")
  const [itemFilter, setItemFilter] = useState("")

  const [notifications, setNotifications] = useState(initialNotifs)
  const [notifOpen, setNotifOpen] = useState(false)
  const [dismissedSpecials, setDismissedSpecials] = useState<Set<string>>(
    new Set()
  )

  const [data, setData] = useState<HubManufacturerData | null>(null)
  const [loading, startLoad] = useTransition()

  const [viewerFileId, setViewerFileId] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K focuses the global search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Load the selected manufacturer's hub data; reset item & filter on switch.
  useEffect(() => {
    if (!selectedMfrId) return
    setData(null)
    setSelectedItemId(null)
    setItemFilter("")
    setTab("lines")
    startLoad(async () => {
      const res = await loadManufacturerHub(selectedMfrId)
      if ("data" in res) {
        setData(res.data)
        setSelectedItemId(res.data.lines[0]?.id ?? null)
      }
    })
  }, [selectedMfrId])

  const selectedMfr = useMemo(
    () => manufacturers.find((m) => m.org.id === selectedMfrId) ?? null,
    [manufacturers, selectedMfrId]
  )

  // Map of manufacturer-id → has-special, for rail $ flags.
  const specialByMfr = useMemo(() => {
    const map = new Map<string, Special>()
    for (const s of initialSpecials) map.set(s.manufacturerOrgId, s)
    return map
  }, [initialSpecials])

  const rawActiveSpecial = selectedMfr
    ? specialByMfr.get(selectedMfr.org.id) ?? null
    : null

  // Bind eligible line ids once the manufacturer's lines load.
  const activeSpecial = useMemo<Special | null>(() => {
    if (!rawActiveSpecial) return null
    if (!data) return rawActiveSpecial
    return applyEligibleLines(rawActiveSpecial, data.lines)
  }, [rawActiveSpecial, data])

  const specialDismissed = activeSpecial
    ? dismissedSpecials.has(activeSpecial.id)
    : false

  const unreadCount = notifications.filter((n) => n.unread).length

  const filteredMfrs = useMemo(() => {
    const q = railFilter.trim().toLowerCase()
    if (!q) return manufacturers
    return manufacturers.filter(
      (m) =>
        m.org.name.toLowerCase().includes(q) ||
        m.org.slug.toLowerCase().includes(q)
    )
  }, [manufacturers, railFilter])

  const filteredLines = useMemo(() => {
    if (!data) return []
    const q = itemFilter.trim().toLowerCase()
    if (!q) return data.lines
    return data.lines.filter((l) => l.name.toLowerCase().includes(q))
  }, [data, itemFilter])

  const selectedLine =
    data?.lines.find((l) => l.id === selectedItemId) ?? null

  const eligibleLineIds = new Set(activeSpecial?.eligibleLineIds ?? [])

  function openFile(id: string) {
    setViewerFileId(id)
    setViewerOpen(true)
  }

  async function handleDownloadAll(line: HubLine) {
    for (const f of line.files) {
      const res = await getFileSignedUrl(f.id)
      if ("data" in res) window.open(res.data.url, "_blank")
    }
  }

  function markAllRead() {
    setNotifications((ns) => ns.map((n) => ({ ...n, unread: false })))
  }

  // Counts shown in the tabs.
  const counts = {
    lines: data?.lines.length ?? selectedMfr?.product_count ?? 0,
    contacts: data?.contacts.length ?? 0,
    pricebooks: data?.pricebooks.length ?? 0,
    cheatsheets: data?.cheatsheets.length ?? 0,
  }

  return (
    <div className="flex h-[calc(100svh-57px)] -m-4 sm:-m-6 flex-col overflow-hidden bg-muted/30">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex h-[52px] shrink-0 items-center gap-4 border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-sm bg-primary" />
          <span className="text-[13px] font-semibold tracking-tight">
            DATAHUB
          </span>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {contextLabel}
        </span>

        <div className="relative mx-auto w-full max-w-[560px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="h-[38px] border-2 border-primary pl-9 pr-14 text-sm focus-visible:ring-0"
            placeholder="Search files, product lines, contacts…"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          onClick={() => {
            setNotifOpen((o) => !o)
            if (!notifOpen) markAllRead()
          }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#c8362b] px-1 text-[9px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* ── Body row ─────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left manufacturer rail */}
        <aside className="flex w-[262px] shrink-0 flex-col border-r bg-background">
          <div className="px-4 pb-3 pt-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
                Manufacturers · {manufacturers.length}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                A–Z ▾
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={railFilter}
                onChange={(e) => setRailFilter(e.target.value)}
                placeholder="Filter…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <Separator />
          <div className="flex-1 overflow-y-auto">
            {filteredMfrs.map((m) => {
              const active = m.org.id === selectedMfrId
              const hasSpecial = specialByMfr.has(m.org.id)
              return (
                <button
                  key={m.org.id}
                  onClick={() => setSelectedMfrId(m.org.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                        {m.org.name.slice(0, 3)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[12px]",
                        active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {m.org.name}
                    </p>
                    <p className="truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      {m.product_count} products
                    </p>
                  </div>
                  {hasSpecial && (
                    <SpecialDollarTag />
                  )}
                </button>
              )
            })}
            {filteredMfrs.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                No manufacturers match.
              </p>
            )}
          </div>
        </aside>

        {/* Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedMfr ? (
            <>
              {/* 3a. Manufacturer header */}
              <div className="flex items-center gap-4 border-b bg-background px-6 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {selectedMfr.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedMfr.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      logo
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[17px] font-semibold leading-none">
                      {selectedMfr.org.name}
                    </h1>
                    <Badge variant="outline" className="font-normal">
                      {selectedMfr.org.slug} · principal
                    </Badge>
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {counts.lines} product lines · territory{" "}
                    {contextLabel.split("·")[1]?.trim() ?? "—"}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Network className="mr-1.5 h-3.5 w-3.5" />
                  Hierarchy
                </Button>
                <Button size="sm">
                  Open portal
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 3b. Promo strip */}
              {activeSpecial && !specialDismissed && (
                <div
                  className="flex flex-wrap items-center gap-3.5 border-b px-6 py-2.5"
                  style={{
                    backgroundColor: "#fdeceb",
                    borderBottomColor: "#f3c9c5",
                  }}
                >
                  <Badge
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                    style={{
                      backgroundColor: "#c8362b",
                      color: "#fff",
                      borderColor: "#c8362b",
                    }}
                  >
                    {activeSpecial.label}
                  </Badge>
                  <span className="text-[13px] font-semibold text-foreground">
                    {activeSpecial.headline}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Ends{" "}
                    {new Date(activeSpecial.endsOn).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                    {data && activeSpecial.eligibleLineIds.length > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        {data.lines
                          .filter((l) =>
                            activeSpecial.eligibleLineIds.includes(l.id)
                          )
                          .map((l) => l.name)
                          .join(" · ")}
                      </>
                    )}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <Button
                      size="sm"
                      style={{
                        backgroundColor: "#c8362b",
                        color: "#fff",
                      }}
                      className="hover:opacity-90"
                    >
                      Start a quote
                    </Button>
                    <button
                      onClick={() =>
                        setDismissedSpecials((s) =>
                          new Set([...s, activeSpecial.id])
                        )
                      }
                      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      View terms
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* 3c. Tabs */}
              <div className="flex gap-6 border-b bg-background px-6">
                {TABS.map((t) => {
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "relative flex items-center gap-1.5 py-3 text-[13px] transition-colors",
                        active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                      <span className="font-mono text-[9px] tracking-widest text-muted-foreground">
                        {counts[t.key]}
                      </span>
                      {active && (
                        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 3d. Body — varies by tab */}
              <div className="flex min-h-0 flex-1">
                {loading || !data ? (
                  <HubBodySkeleton />
                ) : tab === "lines" ? (
                  <LinesBrowser
                    lines={filteredLines}
                    selectedLine={selectedLine}
                    selectedItemId={selectedItemId}
                    setSelectedItemId={setSelectedItemId}
                    itemFilter={itemFilter}
                    setItemFilter={setItemFilter}
                    eligibleLineIds={eligibleLineIds}
                    onOpenFile={openFile}
                    onDownloadAll={handleDownloadAll}
                  />
                ) : tab === "contacts" ? (
                  <ContactsPane contacts={data.contacts} />
                ) : tab === "pricebooks" ? (
                  <FlatFileList
                    title="Price sheets"
                    files={data.pricebooks}
                    onOpenFile={openFile}
                  />
                ) : (
                  <FlatFileList
                    title="Cheat sheets"
                    files={data.cheatsheets}
                    onOpenFile={openFile}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No manufacturers shared with you yet.
            </div>
          )}
        </div>

        {/* Notifications panel */}
        {notifOpen && (
          <div
            className="absolute right-4 top-2 z-20 w-[340px] rounded-md border bg-background shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  You're all caught up.
                </p>
              ) : (
                notifications
                  .slice()
                  .sort((a, b) =>
                    a.kind === b.kind ? 0 : a.kind === "special" ? -1 : 1
                  )
                  .map((n) => (
                    <div
                      key={n.id}
                      className="border-b px-4 py-3 last:border-b-0"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {n.kind === "special" ? (
                          <Badge
                            className="rounded-full px-1.5 py-0 text-[9px] font-semibold tracking-wide"
                            style={{
                              backgroundColor: "#c8362b",
                              color: "#fff",
                              borderColor: "#c8362b",
                            }}
                          >
                            SPECIAL
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-1.5 py-0 text-[9px] font-semibold tracking-wide"
                          >
                            UPDATE
                          </Badge>
                        )}
                        <span className="text-xs font-medium text-foreground">
                          {n.manufacturerName}
                        </span>
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium leading-snug">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                      {n.kind === "special" && n.specialId && (
                        <button
                          onClick={() => {
                            const s = initialSpecials.find(
                              (x) => x.id === n.specialId
                            )
                            if (s) {
                              setSelectedMfrId(s.manufacturerOrgId)
                              setDismissedSpecials((d) => {
                                const next = new Set(d)
                                next.delete(s.id)
                                return next
                              })
                              setNotifOpen(false)
                            }
                          }}
                          className="mt-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          View special →
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      <FileViewer
        fileId={viewerFileId}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  )
}

function SpecialDollarTag() {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white"
      style={{ backgroundColor: "#c8362b" }}
      title="Active special"
    >
      $
    </span>
  )
}

function HubBodySkeleton() {
  return (
    <div className="flex w-full">
      <div className="w-[278px] shrink-0 border-r bg-background p-4">
        <Skeleton className="mb-3 h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-2.5 h-10 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-4 h-14 w-full" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="mb-2 h-10 w-full" />
      </div>
    </div>
  )
}

function LinesBrowser({
  lines,
  selectedLine,
  selectedItemId,
  setSelectedItemId,
  itemFilter,
  setItemFilter,
  eligibleLineIds,
  onOpenFile,
  onDownloadAll,
}: {
  lines: HubLine[]
  selectedLine: HubLine | null
  selectedItemId: string | null
  setSelectedItemId: (id: string) => void
  itemFilter: string
  setItemFilter: (s: string) => void
  eligibleLineIds: Set<string>
  onOpenFile: (id: string) => void
  onDownloadAll: (line: HubLine) => Promise<void>
}) {
  const [downloading, setDownloading] = useState(false)

  async function doDownloadAll() {
    if (!selectedLine) return
    setDownloading(true)
    await onDownloadAll(selectedLine)
    setDownloading(false)
  }

  const eligible = selectedLine && eligibleLineIds.has(selectedLine.id)

  return (
    <>
      {/* Item list pane */}
      <div className="flex w-[278px] shrink-0 flex-col border-r bg-background">
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              placeholder="Filter lines…"
              className="h-[30px] pl-7 text-xs"
            />
          </div>
          <button className="rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted">
            Sort ▾
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {lines.map((line) => {
            const active = selectedItemId === line.id
            const elig = eligibleLineIds.has(line.id)
            return (
              <button
                key={line.id}
                onClick={() => setSelectedItemId(line.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-l-2 px-3.5 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/50"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-[12px]",
                        active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {line.name}
                    </span>
                    {elig && <SpecialDollarTag />}
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {line.product_count} products · {line.file_count} files
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
          {lines.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No product lines.
            </p>
          )}
        </div>
      </div>

      {/* Detail / preview pane */}
      <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
        {selectedLine ? (
          <>
            <div className="flex items-center gap-4 border-b bg-background px-5 py-4">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] uppercase text-muted-foreground">
                img
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold leading-none">
                    {selectedLine.name}
                  </h2>
                  {eligible && (
                    <Badge
                      className="rounded-full px-1.5 py-0 text-[10px] font-semibold tracking-wide"
                      style={{
                        backgroundColor: "#c8362b",
                        color: "#fff",
                        borderColor: "#c8362b",
                      }}
                    >
                      $ ELIGIBLE
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {selectedLine.product_count} products ·{" "}
                  {selectedLine.file_count} files
                </p>
              </div>
              <Button variant="outline" size="sm">
                <UserRound className="mr-1.5 h-3.5 w-3.5" />
                Primary contact info
              </Button>
              <Button
                size="sm"
                onClick={doDownloadAll}
                disabled={downloading || selectedLine.files.length === 0}
              >
                {downloading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Download all
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-5">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Files
                </p>
                <div className="overflow-hidden rounded-md border bg-background">
                  {selectedLine.files.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No files attached to this line.
                    </p>
                  ) : (
                    selectedLine.files.map((f, i) => (
                      <div
                        key={f.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5",
                          i > 0 && "border-t"
                        )}
                      >
                        <div className="flex h-[30px] w-6 shrink-0 items-center justify-center rounded-sm bg-muted">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="flex-1 truncate text-[12px] font-medium">
                          {f.filename}
                        </span>
                        <Badge
                          variant={f.file_type === "datasheet" ? "default" : "secondary"}
                          className="rounded-sm font-mono text-[9px] uppercase tracking-wider"
                        >
                          {f.file_type ?? "file"}
                        </Badge>
                        <span className="w-14 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {formatSize(f.file_size)}
                        </span>
                        <button
                          onClick={() => onOpenFile(f.id)}
                          className="rounded-full border px-2.5 py-1 text-[10px] hover:bg-muted"
                        >
                          Open
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 gap-3.5">
                <div className="flex flex-1 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground">
                  document preview
                </div>
                <aside className="flex w-[206px] shrink-0 flex-col gap-3 rounded-md border bg-background p-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Metadata
                  </span>
                  <div className="space-y-2 text-xs">
                    <MetaRow label="UPDATED" value={formatRelative(selectedLine.updated_at)} />
                    <MetaRow label="FILES" value={String(selectedLine.file_count)} />
                    <MetaRow label="PRODUCTS" value={String(selectedLine.product_count)} />
                    <MetaRow label="FORMAT" value="mixed" />
                  </div>
                  <Separator />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {selectedLine.name.split(" ")[0]}
                    </Badge>
                    {eligible && (
                      <Badge
                        className="rounded-full text-[10px]"
                        style={{
                          backgroundColor: "#c8362b",
                          color: "#fff",
                          borderColor: "#c8362b",
                        }}
                      >
                        Special
                      </Badge>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a product line.
          </div>
        )}
      </div>
    </>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

function ContactsPane({
  contacts,
}: {
  contacts: HubManufacturerData["contacts"]
}) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No contacts published.
      </div>
    )
  }
  return (
    <div className="grid flex-1 auto-rows-min gap-3 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((c) => (
        <div
          key={c.id}
          className="flex flex-col gap-2 rounded-md border bg-background p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <UserRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.title}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            {c.email && (
              <p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  email
                </span>{" "}
                <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                  {c.email}
                </a>
              </p>
            )}
            {c.phone && (
              <p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  phone
                </span>{" "}
                {c.phone}
              </p>
            )}
            {c.region && (
              <p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  region
                </span>{" "}
                {c.region}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function FlatFileList({
  title,
  files,
  onOpenFile,
}: {
  title: string
  files: HubManufacturerData["pricebooks"]
  onOpenFile: (id: string) => void
}) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No {title.toLowerCase()} available.
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-md border bg-background">
        {files.map((f, i) => (
          <div
            key={f.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              i > 0 && "border-t"
            )}
          >
            <div className="flex h-[30px] w-6 shrink-0 items-center justify-center rounded-sm bg-muted">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1 truncate text-[12px] font-medium">
              {f.filename}
            </span>
            <Badge variant="secondary" className="rounded-sm font-mono text-[9px] uppercase tracking-wider">
              {f.file_type ?? "file"}
            </Badge>
            <span className="w-14 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatSize(f.file_size)}
            </span>
            <button
              onClick={() => onOpenFile(f.id)}
              className="rounded-full border px-2.5 py-1 text-[10px] hover:bg-muted"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
