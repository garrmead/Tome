import Link from "next/link"
import {
  Building2,
  FileText,
  Library,
  Package,
  Shield,
} from "lucide-react"

import { getUser } from "@/lib/auth/get-user"
import { getDashboardStats } from "@/lib/search/queries"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string
  value: number
  icon: React.ReactNode
  href?: string
}) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-accent cursor-pointer" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default async function DashboardPage() {
  const { profile, org } = await getUser()
  if (!org) return null

  const stats = await getDashboardStats(org.type, org.id)

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">{org.name}</p>
      </div>

      {/* Stats */}
      {org.type === "manufacturer" && (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your catalog
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Product Lines"
                value={stats.lines ?? 0}
                icon={<Library className="h-4 w-4" />}
                href="/catalog"
              />
              <StatCard
                label="Products"
                value={stats.products ?? 0}
                icon={<Package className="h-4 w-4" />}
                href="/catalog"
              />
              <StatCard
                label="Files"
                value={stats.files ?? 0}
                icon={<FileText className="h-4 w-4" />}
                href="/catalog"
              />
              <StatCard
                label="Active Grants"
                value={stats.grants ?? 0}
                icon={<Shield className="h-4 w-4" />}
                href="/access"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Quick links
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <QuickLink
                href="/catalog"
                title="Manage catalog"
                description="Add product lines, products, and files."
              />
              <QuickLink
                href="/access"
                title="Manage access"
                description="Grant or revoke distributor access."
              />
              <QuickLink
                href="/profile"
                title="Edit profile"
                description="Update your logo, about, and contacts."
              />
            </div>
          </section>
        </>
      )}

      {org.type === "distributor" && (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your access
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                label="Manufacturers"
                value={stats.manufacturers ?? 0}
                icon={<Building2 className="h-4 w-4" />}
                href="/browse"
              />
              <StatCard
                label="Accessible Products"
                value={stats.products ?? 0}
                icon={<Package className="h-4 w-4" />}
                href="/browse"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Quick links
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickLink
                href="/browse"
                title="Browse catalogs"
                description="View products from manufacturers you work with."
              />
              <QuickLink
                href="/search?q="
                title="Search everything"
                description="Find products, files, and more."
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
