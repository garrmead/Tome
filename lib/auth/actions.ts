'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }
  redirect('/signup/onboarding')
}

export async function logIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function sendMagicLink(formData: FormData) {
  const email = formData.get('email') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback` },
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function createOrg(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as 'manufacturer' | 'distributor'
  const fullName = (formData.get('full_name') as string).trim()

  if (!name || !type || !fullName) return { error: 'All fields are required' }

  const admin = createAdminClient()

  let slug = slugify(name)
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) slug = `${slug}-${Date.now()}`

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, slug, type })
    .select()
    .single()

  if (orgError) return { error: orgError.message }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: user.id, org_id: org.id, full_name: fullName, role: 'admin' })

  if (profileError) return { error: profileError.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function getInvitation(token: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('invitations')
    .select('*, organizations(name)')
    .eq('token', token)
    .maybeSingle()
  return data
}

export async function acceptInvitation(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: invitation } = await admin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) return { error: 'Invitation not found' }
  if (invitation.accepted_at) return { error: 'Invitation already used' }
  if (new Date(invitation.expires_at) < new Date()) return { error: 'Invitation expired' }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: user.id, org_id: invitation.org_id, full_name: user.email!, role: invitation.role })

  if (profileError) return { error: profileError.message }

  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
