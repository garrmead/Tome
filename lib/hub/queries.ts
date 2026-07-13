import { createClient } from "@/lib/supabase/server"
import type { HubNotification, Special } from "./types"

// Real specials + notifications (previously mocked in lib/hub/specials.ts).
// RLS scopes both: specials only from granted manufacturers inside their
// live window; notifications only the caller's own rows.

interface SpecialRow {
  id: string
  manufacturer_org_id: string
  label: string
  headline: string
  ends_on: string
  eligible_line_ids: string[]
  terms_url: string | null
}

export async function getLiveSpecials(): Promise<Special[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("specials")
    .select("id, manufacturer_org_id, label, headline, ends_on, eligible_line_ids, terms_url")
    .order("ends_on")

  return ((data ?? []) as SpecialRow[]).map((s) => ({
    id: s.id,
    manufacturerOrgId: s.manufacturer_org_id,
    label: s.label,
    headline: s.headline,
    endsOn: s.ends_on,
    eligibleLineIds: s.eligible_line_ids ?? [],
    termsUrl: s.terms_url ?? "",
  }))
}

interface NotificationRow {
  id: string
  kind: string
  manufacturer_org_id: string | null
  title: string
  body: string | null
  special_id: string | null
  read_at: string | null
  created_at: string
}

export async function getHubNotifications(): Promise<HubNotification[]> {
  const supabase = await createClient()

  const [{ data: rows }, { data: orgs }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, manufacturer_org_id, title, body, special_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("organizations").select("id, name"),
  ])

  const orgName = new Map<string, string>()
  for (const o of (orgs ?? []) as { id: string; name: string }[]) {
    orgName.set(o.id, o.name)
  }

  return ((rows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    kind: n.kind === "special" ? "special" : "info",
    manufacturerName: n.manufacturer_org_id
      ? orgName.get(n.manufacturer_org_id) ?? "Tome"
      : "Tome",
    title: n.title,
    body: n.body ?? "",
    createdAt: n.created_at,
    unread: n.read_at == null,
    specialId: n.special_id ?? undefined,
  }))
}
