import { getUser } from "@/lib/auth/get-user"
import { getAccessibleManufacturers } from "@/lib/distributor/queries"
import { BrowseGrid } from "@/components/distributor/browse-grid"

export default async function BrowsePage() {
  // Authorization is enforced by RLS on every query, but we still gate the
  // page so the experience matches the account type.
  await getUser()

  const manufacturers = await getAccessibleManufacturers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Catalogs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manufacturers who have shared their catalog with you.
        </p>
      </div>
      <BrowseGrid manufacturers={manufacturers} />
    </div>
  )
}
