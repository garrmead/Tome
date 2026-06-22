import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'

// The Hub is a full-viewport console: it deliberately does NOT render the
// standard Tome app header, so the only chrome is its own top bar.
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUser()
  if (!user) redirect('/demo')
  return <div className="h-svh overflow-hidden">{children}</div>
}
