'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEMO_IDENTITIES,
  DEMO_PASSWORD,
  type DemoRole,
} from '@/lib/auth/demo'

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
  redirect('/demo')
}

/**
 * Enter a demo account (distributor or manufacturer) without a login form.
 * We make sure the seeded demo user exists with a known password (resetting it
 * through the admin API if needed), then sign in normally so a real RLS-backed
 * session is created. For the distributor we also grant catalog-wide access
 * from every manufacturer so the Hub looks fully populated.
 */
export async function enterDemo(role: DemoRole) {
  const identity = DEMO_IDENTITIES[role]
  const admin = createAdminClient()

  // 1. Find (or create) the auth user, and force a known password + confirm.
  let userId: string | null = null
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find(
    (u) => u.email?.toLowerCase() === identity.email.toLowerCase()
  )

  if (existing) {
    userId = existing.id
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: identity.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      })
    if (createErr || !created.user) {
      return { error: createErr?.message ?? 'Could not create demo user' }
    }
    userId = created.user.id
  }

  // 2. Make sure the org + profile exist and are linked.
  await admin
    .from('organizations')
    .upsert(
      {
        id: identity.orgId,
        name: identity.orgName,
        slug: identity.orgSlug,
        type: identity.role,
      },
      { onConflict: 'id' }
    )

  await admin.from('profiles').upsert(
    {
      id: userId!,
      org_id: identity.orgId,
      full_name: identity.fullName,
      role: 'admin',
    },
    { onConflict: 'id' }
  )

  // 3. Distributor: ensure an 'all' grant from every manufacturer so the
  //    Hub's rail and tabs are populated. Best-effort; never blocks sign-in.
  if (role === 'distributor') {
    try {
      const { data: mfrs } = await admin
        .from('organizations')
        .select('id')
        .eq('type', 'manufacturer')

      for (const mfr of (mfrs ?? []) as { id: string }[]) {
        const { data: already } = await admin
          .from('access_grants')
          .select('id')
          .eq('manufacturer_org_id', mfr.id)
          .eq('grantee_org_id', identity.orgId)
          .eq('scope_type', 'all')
          .is('grantee_user_id', null)
          .maybeSingle()
        if (already) continue

        const { data: mfrAdmin } = await admin
          .from('profiles')
          .select('id')
          .eq('org_id', mfr.id)
          .limit(1)
          .maybeSingle()

        await admin.from('access_grants').insert({
          manufacturer_org_id: mfr.id,
          grantee_org_id: identity.orgId,
          scope_type: 'all',
          scope_id: null,
          granted_by: mfrAdmin?.id ?? userId,
        })
      }
    } catch {
      // Populating grants is a nicety, not a requirement.
    }
  }

  // 4. Sign in for real — sets the session cookie, RLS now applies.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: identity.email,
    password: DEMO_PASSWORD,
  })
  if (signInErr) return { error: signInErr.message }

  revalidatePath('/', 'layout')
  redirect(identity.landing)
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
