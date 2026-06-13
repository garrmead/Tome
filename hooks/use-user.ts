'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Org } from '@/lib/auth/get-user'
import type { User } from '@supabase/supabase-js'

async function fetchUserContext(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, org: null }

  const { data } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return { user, profile: null, org: null }

  const { organizations, ...profile } = data as any
  return { user: user as User, profile: profile as Profile, org: organizations as Org }
}

export function useUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    })
    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  return useQuery({
    queryKey: ['user'],
    queryFn: () => fetchUserContext(supabase),
  })
}
