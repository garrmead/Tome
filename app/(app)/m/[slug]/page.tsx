import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2 } from "lucide-react"

import {
  getManufacturerView,
  getAccessibleLines,
  getPricebookFiles,
} from "@/lib/distributor/queries"
import { ManufacturerTabs } from "@/components/distributor/manufacturer-tabs"

interface Props {
  params: { slug: string }
}

export default async function ManufacturerPage({ params }: Props) {
  const view = await getManufacturerView(params.slug)
  if (!view) notFound()

  const { org, profile, contacts, show_price_books } = view

  const [lines, pricebooks] = await Promise.all([
    getAccessibleLines(org.id),
    show_price_books ? getPricebookFiles(org.id) : Promise.resolve([]),
  ])

  const logo = profile?.logo_url ?? org.logo_url ?? null

  return (
    <div className="space-y-6">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Browse
      </Link>

      {/* Header: logo, name, tagline */}
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={org.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          {profile?.tagline && (
            <p className="mt-1 text-muted-foreground">{profile.tagline}</p>
          )}
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-primary underline-offset-2 hover:underline"
            >
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      <ManufacturerTabs
        slug={org.slug}
        profile={profile}
        contacts={contacts}
        lines={lines}
        pricebooks={pricebooks}
        showPriceBooks={show_price_books}
      />
    </div>
  )
}
