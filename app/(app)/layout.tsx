import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { signOut } from '@/lib/auth/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, org } = await getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-lg">Tome</span>
          {org?.type === 'manufacturer' && (
            <>
              <Link
                href="/catalog"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Catalog
              </Link>
              <Link
                href="/access"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Access
              </Link>
              <Link
                href="/profile"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Profile
              </Link>
            </>
          )}
          {org?.type === 'distributor' && (
            <Link
              href="/browse"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{profile?.full_name}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">{org?.type}</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-foreground transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
