import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package } from "lucide-react"

import { getProductLine, getProductsForLine } from "@/lib/catalog/queries"
import { LineHeader } from "@/components/catalog/line-header"
import { NewProductDialog } from "@/components/catalog/new-product-dialog"
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
  params: { id: string }
}

export default async function ProductLinePage({ params }: Props) {
  // Both queries only need the id — fetch them in parallel instead of
  // waterfalling line → products.
  const [line, products] = await Promise.all([
    getProductLine(params.id),
    getProductsForLine(params.id),
  ])
  if (!line) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Product Lines
      </Link>

      <LineHeader line={line} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Products</h2>
        <NewProductDialog lineId={params.id} />
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No products in this line yet</p>
              <p className="text-sm text-muted-foreground">
                Add a product to start filling out this line.
              </p>
            </div>
            <NewProductDialog lineId={params.id} />
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
                      href={`/catalog/products/${product.id}`}
                      className="font-mono hover:underline"
                    >
                      {product.model_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/catalog/products/${product.id}`}
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
