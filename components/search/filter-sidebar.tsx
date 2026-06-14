"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface FilterSidebarProps {
  type: string
  q: string
  currentMfr?: string
  currentCat?: string
  currentFt?: string
  manufacturers: { id: string; name: string }[]
  categories: string[]
  fileTypes: { value: string; label: string }[]
}

function FilterPanel({
  type,
  q,
  currentMfr,
  currentCat,
  currentFt,
  manufacturers,
  categories,
  fileTypes,
}: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    router.push(`${pathname}?q=${encodeURIComponent(q)}&type=${type}`)
  }

  const hasFilters = !!(currentMfr || currentCat || currentFt)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Filters</p>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Manufacturer filter — always shown */}
      {manufacturers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Manufacturer
          </p>
          <div className="space-y-1">
            <FilterOption
              label="All"
              active={!currentMfr}
              onClick={() => setFilter("mfr", undefined)}
            />
            {manufacturers.map((m) => (
              <FilterOption
                key={m.id}
                label={m.name}
                active={currentMfr === m.id}
                onClick={() =>
                  setFilter("mfr", currentMfr === m.id ? undefined : m.id)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Category filter (products only) */}
      {type === "product" && categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Category
          </p>
          <div className="space-y-1">
            <FilterOption
              label="All"
              active={!currentCat}
              onClick={() => setFilter("cat", undefined)}
            />
            {categories.map((c) => (
              <FilterOption
                key={c}
                label={c}
                active={currentCat === c}
                onClick={() =>
                  setFilter("cat", currentCat === c ? undefined : c)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* File type filter (files only) */}
      {type === "file" && fileTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            File Type
          </p>
          <div className="space-y-1">
            <FilterOption
              label="All"
              active={!currentFt}
              onClick={() => setFilter("ft", undefined)}
            />
            {fileTypes.map((ft) => (
              <FilterOption
                key={ft.value}
                label={ft.label}
                active={currentFt === ft.value}
                onClick={() =>
                  setFilter("ft", currentFt === ft.value ? undefined : ft.value)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterOption({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

export function FilterSidebar(props: FilterSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block sticky top-6 rounded-xl border bg-card p-4">
        <FilterPanel {...props} />
      </div>

      {/* Mobile sheet trigger */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FilterPanel {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
