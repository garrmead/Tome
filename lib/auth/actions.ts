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
 *
 * To stay robust against a half-cleaned auth schema (deleted seed users can
 * leave orphaned identities that make createUser fail), we AVOID creating
 * users whenever possible: we adopt an existing auth user — preferring the
 * seeded demo email, otherwise any account that already exists — reset its
 * password to a known value, and repoint its profile at the demo org for the
 * chosen role. Only if there are literally no users do we create one. Then we
 * sign in for real so a proper RLS-backed session is created.
 */
export async function enterDemo(role: DemoRole) {
  const identity = DEMO_IDENTITIES[role]
  const admin = createAdminClient()

  // 1. Pick an auth user to act as this demo identity.
  let userId: string | null = null
  let email = identity.email
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const users = list?.users ?? []
  const target =
    users.find((u) => u.email?.toLowerCase() === identity.email.toLowerCase()) ??
    users[0] // fall back to whatever account already exists

  if (target) {
    userId = target.id
    email = target.email ?? identity.email
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      target.id,
      {
        password: DEMO_PASSWORD,
        email_confirm: true,
      }
    )
    if (updateErr) {
      console.error('[enterDemo] failed to reset demo user password:', updateErr)
      return { error: `Could not prepare demo user: ${updateErr.message}` }
    }
  } else {
    // No users at all — create the seeded demo user.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: identity.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      })
    if (createErr || !created.user) {
      return {
        error:
          (createErr?.message ?? 'Could not create demo user') +
          ' — try creating any user once via the Supabase dashboard, then retry.',
      }
    }
    userId = created.user.id
    email = identity.email
  }

  // 2. Make sure the org + profile exist and are linked. These are hard
  //    requirements — without a profile row, current_org_id() is NULL and
  //    RLS hides everything, so surface failures instead of pressing on.
  const { error: orgErr } = await admin
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
  if (orgErr) {
    console.error('[enterDemo] failed to upsert demo org:', orgErr)
    return { error: `Could not set up demo organization: ${orgErr.message}` }
  }

  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id: userId!,
      org_id: identity.orgId,
      full_name: identity.fullName,
      role: 'admin',
    },
    { onConflict: 'id' }
  )
  if (profileErr) {
    console.error('[enterDemo] failed to upsert demo profile:', profileErr)
    return { error: `Could not set up demo profile: ${profileErr.message}` }
  }

  // 3. Distributor: ensure an active 'all' grant from every manufacturer so
  //    the Hub's rail and tabs are populated. Failures here don't block
  //    sign-in, but they are always logged — an empty Hub with no error in
  //    the server logs is exactly the bug this used to cause.
  if (role === 'distributor') {
    const { data: mfrs, error: mfrsErr } = await admin
      .from('organizations')
      .select('id')
      .eq('type', 'manufacturer')
    if (mfrsErr) {
      console.error('[enterDemo] failed to list manufacturers for demo grants:', mfrsErr)
    }

    for (const mfr of (mfrs ?? []) as { id: string }[]) {
      const { data: existing, error: existingErr } = await admin
        .from('access_grants')
        .select('id, revoked_at')
        .eq('manufacturer_org_id', mfr.id)
        .eq('grantee_org_id', identity.orgId)
        .eq('scope_type', 'all')
        .is('grantee_user_id', null)
        .limit(1)
        .maybeSingle()
      if (existingErr) {
        console.error(
          `[enterDemo] failed to check existing grant for manufacturer ${mfr.id}:`,
          existingErr
        )
        continue
      }

      if (existing) {
        // A revoked grant is invisible under RLS — reactivate it, since a
        // fresh insert would collide with the unique constraint.
        if (existing.revoked_at) {
          const { error: unrevokeErr } = await admin
            .from('access_grants')
            .update({ revoked_at: null })
            .eq('id', existing.id)
          if (unrevokeErr) {
            console.error(
              `[enterDemo] failed to reactivate revoked grant ${existing.id}:`,
              unrevokeErr
            )
          }
        }
        continue
      }

      const { data: mfrAdmin, error: mfrAdminErr } = await admin
        .from('profiles')
        .select('id')
        .eq('org_id', mfr.id)
        .limit(1)
        .maybeSingle()
      if (mfrAdminErr) {
        console.error(
          `[enterDemo] failed to look up an admin for manufacturer ${mfr.id}:`,
          mfrAdminErr
        )
      }

      const { error: insertErr } = await admin.from('access_grants').insert({
        manufacturer_org_id: mfr.id,
        grantee_org_id: identity.orgId,
        scope_type: 'all',
        scope_id: null,
        granted_by: mfrAdmin?.id ?? userId,
      })
      if (insertErr) {
        console.error(
          `[enterDemo] failed to create demo grant from manufacturer ${mfr.id}:`,
          insertErr
        )
      }
    }
  }

  // 4. Sign in for real — sets the session cookie, RLS now applies.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
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
