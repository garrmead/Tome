import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  org_id: string
  full_name: string
  role: 'admin' | 'member'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Org {
  id: string
  name: string
  slug: string
  type: 'manufacturer' | 'distributor'
  logo_url: string | null
  website: string | null
}

export async function getUser(): Promise<
  | { user: User; profile: Profile; org: Org }
  | { user: null; profile: null; org: null }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, org: null }

  const { data } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return { user, profile: null, org: null }

  const { organizations, ...profile } = data as any
  return { user, profile: profile as Profile, org: organizations as Org }
}
