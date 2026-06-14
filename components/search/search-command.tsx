"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Clock,
  FileText,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react"

import { searchAction } from "@/lib/search/actions"
import type { SearchResults } from "@/lib/search/types"
import { FILE_TYPE_LABELS, type FileType } from "@/lib/catalog/types"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

const RECENT_KEY = "tome:recent-searches"
const MAX_RECENT = 5

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
  } catch {
    return []
  }
}

function pushRecent(term: string) {
  try {
    const list = [term, ...getRecent().filter((t) => t !== term)].slice(
      0,
      MAX_RECENT
    )
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {}
}

interface Props {
  /** org type of current user — determines result links */
  orgType?: "manufacturer" | "distributor"
}

export function SearchCommand({ orgType }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [recent, setRecent] = useState<string[]>([])
  const [results, setResults] = useState<SearchResults | null>(null)
  const [pending, startSearch] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [])

  // Load recent on open
  useEffect(() => {
    if (open) {
      setRecent(getRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setInput("")
      setResults(null)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!input.trim()) {
      setResults(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const res = await searchAction(input.trim())
        setResults(res)
      })
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input])

  function navigate(href: string, term?: string) {
    if (term) pushRecent(term)
    else if (input.trim()) pushRecent(input.trim())
    setOpen(false)
    router.push(href)
  }

  function handleEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      navigate(`/search?q=${encodeURIComponent(input.trim())}`, input.trim())
    }
  }

  const totalResults = results
    ? results.manufacturers.length +
      results.lines.length +
      results.products.length +
      results.files.length
    : 0

  function productHref(id: string): string {
    return orgType === "manufacturer"
      ? `/catalog/products/${id}`
      : `/search?q=${encodeURIComponent(input)}&type=product`
  }

  function lineHref(mfrSlug: string, id: string): string {
    return orgType === "manufacturer"
      ? `/catalog/lines/${id}`
      : `/m/${mfrSlug}/lines/${id}`
  }

  return (
    <>
      {/* Trigger — a fake search input shown in the nav */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 rounded bg-background border px-1.5 py-0.5 font-mono text-xs">
          ⌘K
        </kbd>
      </button>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sm:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>

          {/* Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="Search manufacturers, products, files…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {pending && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            {input && !pending && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* No input: recent searches */}
            {!input.trim() && recent.length > 0 && (
              <div className="p-2">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Recent
                </p>
                {recent.map((term) => (
                  <button
                    key={term}
                    onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`, term)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {term}
                  </button>
                ))}
              </div>
            )}

            {/* Searching placeholder */}
            {input.trim() && pending && !results && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Searching…
              </div>
            )}

            {/* No results */}
            {!pending && results && totalResults === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No results for &quot;{input}&quot;
              </div>
            )}

            {/* Results */}
            {results && totalResults > 0 && (
              <div className="p-2 space-y-1">
                {results.manufacturers.length > 0 && (
                  <Section label="Manufacturers">
                    {results.manufacturers.map((m) => (
                      <ResultRow
                        key={m.id}
                        icon={<Building2 className="h-4 w-4" />}
                        primary={m.name}
                        onClick={() => navigate(`/m/${m.slug}`)}
                      />
                    ))}
                  </Section>
                )}

                {results.lines.length > 0 && (
                  <Section label="Product Lines">
                    {results.lines.map((l) => {
                      const mfr = results.orgMap[l.manufacturer_org_id]
                      return (
                        <ResultRow
                          key={l.id}
                          icon={<Package className="h-4 w-4" />}
                          primary={l.name}
                          secondary={mfr?.name}
                          onClick={() =>
                            navigate(lineHref(mfr?.slug ?? "", l.id))
                          }
                        />
                      )
                    })}
                  </Section>
                )}

                {results.products.length > 0 && (
                  <Section label="Products">
                    {results.products.map((p) => {
                      const mfr = results.orgMap[p.manufacturer_org_id]
                      return (
                        <ResultRow
                          key={p.id}
                          icon={<Package className="h-4 w-4" />}
                          primary={`${p.model_number} – ${p.name}`}
                          secondary={mfr?.name}
                          onClick={() => navigate(productHref(p.id))}
                        />
                      )
                    })}
                  </Section>
                )}

                {results.files.length > 0 && (
                  <Section label="Files">
                    {results.files.map((f) => {
                      const mfr = results.orgMap[f.owner_org_id]
                      return (
                        <ResultRow
                          key={f.id}
                          icon={<FileText className="h-4 w-4" />}
                          primary={f.filename}
                          secondary={
                            f.file_type
                              ? (FILE_TYPE_LABELS[f.file_type as FileType] ??
                                f.file_type)
                              : mfr?.name
                          }
                          onClick={() =>
                            navigate(
                              `/search?q=${encodeURIComponent(input)}&type=file`
                            )
                          }
                        />
                      )
                    })}
                  </Section>
                )}
              </div>
            )}

            {/* Footer */}
            {input.trim() && (
              <div className="border-t px-4 py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/search?q=${encodeURIComponent(input.trim())}`,
                      input.trim()
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Press <kbd className="rounded border px-1 font-mono">↵</kbd>{" "}
                  to see all results for &quot;{input}&quot;
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function ResultRow({
  icon,
  primary,
  secondary,
  onClick,
}: {
  icon: React.ReactNode
  primary: string
  secondary?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted text-left"
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{primary}</span>
      {secondary && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {secondary}
        </span>
      )}
    </button>
  )
}
