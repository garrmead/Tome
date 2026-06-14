import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'

export default async function Home() {
  const { user, org } = await getUser()
  if (!user) redirect('/login')
  // Distributors land on the browse experience; manufacturers on their catalog.
  if (org?.type === 'distributor') redirect('/browse')
  if (org?.type === 'manufacturer') redirect('/catalog')
  redirect('/dashboard')
}
