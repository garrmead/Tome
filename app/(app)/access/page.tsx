import { getUser } from '@/lib/auth/get-user'
import { getActiveGrants, getMfgProductLines, getMfgProducts, getMfgFiles } from '@/lib/access/queries'
import { Card, CardContent } from '@/components/ui/card'
import { GrantsTable } from '@/components/access/grants-table'
import { GrantDialog } from '@/components/access/grant-dialog'

export default async function AccessPage() {
  const { org } = await getUser()

  if (org?.type !== 'manufacturer') {
    return (
      <div className="flex justify-center mt-16">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Access management is only available to manufacturer accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [grants, productLines, products, files] = await Promise.all([
    getActiveGrants(),
    getMfgProductLines(),
    getMfgProducts(),
    getMfgFiles(),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Access Grants</h1>
        <GrantDialog productLines={productLines} products={products} files={files} />
      </div>
      <GrantsTable grants={grants} />
    </div>
  )
}
