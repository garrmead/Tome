import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { signOut } from '@/lib/auth/actions'
import { SearchCommand } from '@/components/search/search-command'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, org } = await getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="font-semibold text-lg">Tome</Link>
          {org?.type === 'manufacturer' && (
            <>
              <Link href="/catalog" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Catalog</Link>
              <Link href="/access"  className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Access</Link>
              <Link href="/profile" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Profile</Link>
            </>
          )}
          {org?.type === 'distributor' && (
            <>
              <Link href="/hub"    className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Hub</Link>
              <Link href="/browse" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
            </>
          )}
        </div>

        {/* Center: search */}
        <div className="flex-1 flex justify-center">
          <SearchCommand orgType={org?.type} />
        </div>

        {/* Right: user info + sign out */}
        <div className="flex items-center gap-3 shrink-0 text-sm text-muted-foreground">
          <span className="hidden sm:block">{profile?.full_name}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">{org?.type}</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-foreground transition-colors">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
