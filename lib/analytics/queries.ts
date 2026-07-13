import { createClient } from "@/lib/supabase/server"

export type AnalyticsEventType =
  | "file_preview"
  | "file_download"
  | "hub_view"
  | "search"
  | "rfq_submitted"

export interface AnalyticsEvent {
  id: string
  actor_user_id: string | null
  actor_org_id: string | null
  manufacturer_org_id: string
  event_type: AnalyticsEventType
  subject_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface FileRef {
  id: string
  filename: string
}

export interface GranteeOrg {
  id: string
  name: string
}

/**
 * Events for the caller's manufacturer org over the last 30 days.
 * RLS already scopes rows to manufacturer_org_id = caller's org, so no
 * explicit org filter is needed — the time window is the only predicate.
 */
export async function getRecentEvents(): Promise<AnalyticsEvent[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from("events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: true })

  return (data as AnalyticsEvent[]) ?? []
}

/** Manufacturer's own files — used to resolve filenames for "Top files". */
export async function getFileRefs(): Promise<FileRef[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("files").select("id, filename")
  return (data as FileRef[]) ?? []
}

/**
 * Distributor orgs holding an active grant from the caller. The joined org
 * row is readable thanks to the policy letting manufacturers SELECT
 * distributor orgs they have granted access to.
 */
export async function getActiveGranteeOrgs(): Promise<GranteeOrg[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("access_grants")
    .select("grantee_org_id, grantee_org:grantee_org_id(id, name)")
    .is("revoked_at", null)

  const seen = new Map<string, GranteeOrg>()
  for (const row of (data as any[]) ?? []) {
    const org = row.grantee_org as GranteeOrg | null
    if (org && !seen.has(org.id)) seen.set(org.id, org)
  }
  return [...seen.values()]
}
