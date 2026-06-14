"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Building2, Package } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ManufacturerCard } from "@/lib/distributor/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function BrowseGrid({ manufacturers }: { manufacturers: ManufacturerCard[] }) {
  const [category, setCategory] = useState<string>("all")

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const m of manufacturers) m.categories.forEach((c) => set.add(c))
    return [...set].sort()
  }, [manufacturers])

  const filtered = useMemo(() => {
    if (category === "all") return manufacturers
    return manufacturers.filter((m) => m.categories.includes(category))
  }, [manufacturers, category])

  return (
    <div className="space-y-6">
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All categories"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {categories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">
                {category === "all"
                  ? "No manufacturers yet"
                  : "No manufacturers in this category"}
              </p>
              <p className="text-sm text-muted-foreground">
                {category === "all"
                  ? "When a manufacturer grants you access, their catalog appears here."
                  : "Try a different category filter."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Link key={m.org.id} href={`/m/${m.org.slug}`}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.logo_url}
                        alt={m.org.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate">{m.org.name}</CardTitle>
                    {m.tagline && (
                      <p className="truncate text-sm text-muted-foreground">
                        {m.tagline}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {m.product_count}{" "}
                    {m.product_count === 1 ? "product" : "products"} available
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
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
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
