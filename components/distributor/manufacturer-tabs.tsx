"use client"

import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Mail, Phone, MapPin, Package, FileText, Network } from "lucide-react"

import type { ManufacturerProfile, Contact, ProductFile, ProductLine } from "@/lib/distributor/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileList } from "./file-list"

const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-3 mb-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  p: ({ children }: any) => <p className="mb-2">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => <code className="bg-muted rounded px-1 font-mono text-xs">{children}</code>,
  a: ({ href, children }: any) => <a href={href} className="text-primary underline underline-offset-2">{children}</a>,
}

interface Props {
  slug: string
  profile: ManufacturerProfile | null
  contacts: Contact[]
  lines: (ProductLine & { product_count: number })[]
  pricebooks: ProductFile[]
  showPriceBooks: boolean
}

export function ManufacturerTabs({
  slug,
  profile,
  contacts,
  lines,
  pricebooks,
  showPriceBooks,
}: Props) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="lines">Product Lines</TabsTrigger>
        <TabsTrigger value="contact">Contact</TabsTrigger>
        <TabsTrigger value="org-chart">Org Chart</TabsTrigger>
        {showPriceBooks && (
          <TabsTrigger value="price-books">Price Books</TabsTrigger>
        )}
      </TabsList>

      {/* ── Overview ─────────────────────────────────────────────── */}
      <TabsContent value="overview">
        <Card>
          <CardContent className="pt-6 text-sm leading-relaxed">
            {profile?.about ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {profile.about}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">
                This manufacturer hasn’t added an overview yet.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Product Lines ────────────────────────────────────────── */}
      <TabsContent value="lines">
        {lines.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No product lines are available to you yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((line) => (
              <Link key={line.id} href={`/m/${slug}/lines/${line.id}`}>
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle>{line.name}</CardTitle>
                    {line.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {line.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      {line.product_count}{" "}
                      {line.product_count === 1 ? "product" : "products"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Contact ──────────────────────────────────────────────── */}
      <TabsContent value="contact">
        <Card>
          <CardContent className="space-y-6 pt-6">
            {(profile?.contact_email || profile?.contact_phone) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">General</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {profile?.contact_email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <a
                        href={`mailto:${profile.contact_email}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {profile.contact_email}
                      </a>
                    </p>
                  )}
                  {profile?.contact_phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {profile.contact_phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {contacts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {contacts.map((ct) => (
                  <div key={ct.id} className="rounded-lg border p-4">
                    <p className="font-medium">{ct.name || "—"}</p>
                    {ct.title && (
                      <p className="text-sm text-muted-foreground">{ct.title}</p>
                    )}
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {ct.email && (
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          <a
                            href={`mailto:${ct.email}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {ct.email}
                          </a>
                        </p>
                      )}
                      {ct.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {ct.phone}
                        </p>
                      )}
                      {ct.region && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {ct.region}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !profile?.contact_email &&
              !profile?.contact_phone && (
                <p className="text-sm text-muted-foreground italic">
                  No contact information provided.
                </p>
              )
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Org Chart ────────────────────────────────────────────── */}
      <TabsContent value="org-chart">
        <Card>
          <CardContent className="pt-6">
            {profile?.org_chart_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.org_chart_url}
                alt="Organization chart"
                className="mx-auto max-h-[70vh] w-full rounded-md border object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <Network className="h-10 w-10" />
                <p className="text-sm">No org chart has been shared.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Price Books ──────────────────────────────────────────── */}
      {showPriceBooks && (
        <TabsContent value="price-books">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Price Books
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileList
                files={pricebooks}
                emptyLabel="No price books are available to you."
              />
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  )
}
