"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUser } from "@/lib/auth/get-user"
import type { Org, Profile } from "@/lib/auth/get-user"
import type { User } from "@supabase/supabase-js"
import type { DistributorOrg, EmailResolution, ScopeType } from "./types"

type ActionResult<T = void> = { error: string } | { data: T }

type ManufacturerCtx =
  | { ok: false; error: string }
  | { ok: true; user: User; profile: Profile; org: Org }

async function requireManufacturer(): Promise<ManufacturerCtx> {
  const { user, profile, org } = await getUser()
  if (!user || !profile || !org) return { ok: false, error: "Not authenticated" }
  if (org.type !== "manufacturer")
    return { ok: false, error: "Only manufacturers can manage access grants" }
  return { ok: true, user, profile, org }
}

// ── Distributor search (admin client — RLS blocks manufacturer from seeing distributors) ──

export async function searchDistributorOrgs(
  query: string
): Promise<ActionResult<DistributorOrg[]>> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const admin = createAdminClient()
  const trimmed = query.trim()

  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("type", "distributor")
    .or(
      trimmed
        ? `name.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`
        : "id.neq.00000000-0000-0000-0000-000000000000" // always-true fallback
    )
    .order("name")
    .limit(20)

  if (error) return { error: error.message }
  return { data: (data as DistributorOrg[]) ?? [] }
}

// ── Grant creation ─────────────────────────────────────────────────────────

export async function createGrants(input: {
  grantee_org_id: string
  scopes: Array<{ type: ScopeType; id: string | null }>
  user_emails?: string[]
}): Promise<
  ActionResult<{ grants_created: number; email_results: EmailResolution[] }>
> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }

  const admin = createAdminClient()
  const email_results: EmailResolution[] = []

  // ── Resolve user emails if supplied ───────────────────────────────────────
  // Each email that maps to a profile in the grantee org gets a user-level
  // grant; others get an invitation to join the org.
  const granted_user_ids: string[] = []

  if (input.user_emails && input.user_emails.length > 0) {
    for (const email of input.user_emails) {
      const { data: rows } = await admin.rpc("lookup_user_by_email", {
        p_email: email,
      })

      const row = rows?.[0] as
        | { user_id: string; profile_org_id: string | null }
        | undefined

      if (row?.profile_org_id === input.grantee_org_id) {
        // User is already a member of the grantee org
        granted_user_ids.push(row.user_id)
        email_results.push({ email, status: "granted", user_id: row.user_id })
      } else {
        // Create an invitation so they can join the org
        const { data: orgAdmin } = await admin
          .from("profiles")
          .select("id")
          .eq("org_id", input.grantee_org_id)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle()

        if (orgAdmin) {
          await admin.from("invitations").insert({
            org_id: input.grantee_org_id,
            invited_by: orgAdmin.id,
            email,
            role: "member",
          })
          email_results.push({ email, status: "invited" })
        } else {
          email_results.push({ email, status: "no_org_admin" })
        }
      }
    }
  }

  // ── Build grant rows ───────────────────────────────────────────────────────
  // If specific user_ids were resolved, create per-user grants.
  // Otherwise (no emails provided, or all emails resulted in invitations),
  // create org-level grants.
  const usersToGrant =
    granted_user_ids.length > 0 ? granted_user_ids : [null]

  const rows = usersToGrant.flatMap((user_id) =>
    input.scopes.map((scope) => ({
      manufacturer_org_id: ctx.org.id,
      grantee_org_id: input.grantee_org_id,
      grantee_user_id: user_id,
      scope_type: scope.type,
      scope_id: scope.id ?? null,
      granted_by: ctx.profile.id,
    }))
  )

  let grants_created = 0

  if (rows.length > 0) {
    // Ignore unique-constraint violations (duplicate grants) silently
    const { data: inserted, error } = await admin
      .from("access_grants")
      .insert(rows)
      .select("id")

    if (error && error.code !== "23505") return { error: error.message }
    grants_created = inserted?.length ?? 0
  }

  revalidatePath("/access")
  return { data: { grants_created, email_results } }
}

// ── Revocation ─────────────────────────────────────────────────────────────

export async function revokeGrants(
  grantIds: string[]
): Promise<ActionResult> {
  const ctx = await requireManufacturer()
  if (!ctx.ok) return { error: ctx.error }
  if (grantIds.length === 0) return { data: undefined }

  // Use the authenticated client; the "mfr admin manages grants" policy covers
  // UPDATE for admins of the manufacturer org.
  const supabase = await createClient()
  const { error } = await supabase
    .from("access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .in("id", grantIds)
    .eq("manufacturer_org_id", ctx.org.id)

  if (error) return { error: error.message }
  revalidatePath("/access")
  return { data: undefined }
}
