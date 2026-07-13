import Link from "next/link"
import { Library } from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import { getProductLines } from "@/lib/catalog/queries"
import { BulkUploadDialog } from "@/components/catalog/bulk-upload"
import { CsvImportDialog } from "@/components/catalog/csv-import"
import { NewProductLineDialog } from "@/components/catalog/new-product-line-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function CatalogPage() {
  // Fetch auth context and lines in parallel — RLS already scopes the lines
  // to the caller's org, so the list is safe to request up front.
  const [{ org }, lines] = await Promise.all([getUser(), getProductLines()])

  if (org?.type !== "manufacturer") {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Manufacturers only</CardTitle>
          <CardDescription>
            Catalog management is available to manufacturer organizations.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Product Lines</h1>
        <div className="flex items-center gap-2">
          <CsvImportDialog />
          <BulkUploadDialog orgId={org.id} lines={lines} />
          <NewProductLineDialog />
        </div>
      </div>

      {lines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Library className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No product lines yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first product line to start building your catalog.
              </p>
            </div>
            <NewProductLineDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lines.map((line) => (
            <Link key={line.id} href={`/catalog/lines/${line.id}`}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle>{line.name}</CardTitle>
                  {line.description && (
                    <CardDescription className="line-clamp-2">
                      {line.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
