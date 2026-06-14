import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package } from "lucide-react"

import {
  getManufacturerOrgBySlug,
  getLineForView,
  getProductsForLineView,
} from "@/lib/distributor/queries"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Props {
  params: { slug: string; lineId: string }
}

export default async function DistributorLinePage({ params }: Props) {
  const org = await getManufacturerOrgBySlug(params.slug)
  if (!org) notFound()

  const line = await getLineForView(org.id, params.lineId)
  if (!line) notFound()

  const products = await getProductsForLineView(params.lineId)

  return (
    <div className="space-y-6">
      <Link
        href={`/m/${params.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {org.name}
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{line.name}</h1>
        {line.description && (
          <p className="text-muted-foreground">{line.description}</p>
        )}
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No products in this line are available to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/m/${params.slug}/products/${product.id}`}
                      className="font-mono hover:underline"
                    >
                      {product.model_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/m/${params.slug}/products/${product.id}`}
                      className="hover:underline"
                    >
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.category ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
