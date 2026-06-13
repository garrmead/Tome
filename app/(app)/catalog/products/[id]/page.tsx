import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import {
  getProduct,
  getProductFiles,
  getProductTags,
} from "@/lib/catalog/queries"
import { ProductDetailsEditor } from "@/components/catalog/product-details-editor"
import { ProductTags } from "@/components/catalog/product-tags"
import { FileManager } from "@/components/catalog/file-manager"
import { Badge } from "@/components/ui/badge"

interface Props {
  params: { id: string }
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.id)
  if (!product) notFound()

  const [tags, files, { org }] = await Promise.all([
    getProductTags(params.id),
    getProductFiles(params.id),
    getUser(),
  ])

  return (
    <div className="space-y-6">
      <Link
        href={`/catalog/lines/${product.product_line_id}`}
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
      </div>

      <ProductDetailsEditor product={product} />
      <ProductTags productId={params.id} tags={tags} />
      {org && <FileManager product={product} orgId={org.id} files={files} />}
    </div>
  )
}
