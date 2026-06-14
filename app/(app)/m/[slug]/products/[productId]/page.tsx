import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import {
  getManufacturerOrgBySlug,
  getProductForView,
  getProductFilesView,
} from "@/lib/distributor/queries"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FileList } from "@/components/distributor/file-list"

interface Props {
  params: { slug: string; productId: string }
}

function renderSpecValue(value: unknown): string {
  if (value == null) return "—"
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export default async function DistributorProductPage({ params }: Props) {
  const org = await getManufacturerOrgBySlug(params.slug)
  if (!org) notFound()

  const product = await getProductForView(params.productId)
  // Guard the URL: the product must exist, be visible (RLS), and belong to the
  // manufacturer named in the slug.
  if (!product || product.manufacturer_org_id !== org.id) notFound()

  const files = await getProductFilesView(params.productId)

  const specs = product.specs ?? {}
  const specEntries = Object.entries(specs)

  return (
    <div className="space-y-6">
      <Link
        href={`/m/${params.slug}/lines/${product.product_line_id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to line
      </Link>

      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">
          {product.model_number}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.category && <Badge>{product.category}</Badge>}
        </div>
        {product.description && (
          <p className="pt-2 text-muted-foreground">{product.description}</p>
        )}
      </div>

      {/* Specs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          {specEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No specifications provided.
            </p>
          ) : (
            <dl className="divide-y">
              {specEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4"
                >
                  <dt className="text-sm font-medium capitalize">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="text-sm text-muted-foreground sm:col-span-2">
                    {renderSpecValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files</CardTitle>
        </CardHeader>
        <CardContent>
          <FileList files={files} emptyLabel="No files available for this product." />
        </CardContent>
      </Card>
    </div>
  )
}
