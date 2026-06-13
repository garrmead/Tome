import { getUser } from '@/lib/auth/get-user'

export default async function DashboardPage() {
  const { profile, org } = await getUser()
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {profile?.full_name}</h1>
      <p className="mt-2 text-muted-foreground">{org?.name} · {org?.type}</p>
    </div>
  )
}
