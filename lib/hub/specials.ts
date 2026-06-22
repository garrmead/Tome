import type { HubNotification, Special } from "./types"
import type { ManufacturerCard } from "@/lib/distributor/types"
import type { HubLine } from "./types"

// Mocked specials feed — no DB table yet. Keyed by manufacturer org id so the
// UI can wire the four surfaces (rail $ tag, promo strip, eligible-line tags,
// bell notification) from a single concept.
export function buildMockSpecials(
  manufacturers: ManufacturerCard[]
): Special[] {
  if (manufacturers.length === 0) return []
  const first = manufacturers[0]
  return [
    {
      id: `special-${first.org.id}`,
      manufacturerOrgId: first.org.id,
      label: "SPECIAL · ACTIVE",
      headline:
        "Replace a competitor pump and your customer gets $100 back.",
      endsOn: "2026-07-31",
      eligibleLineIds: [],
      termsUrl: "#",
    },
  ]
}

/** Attach concrete eligible line ids once a manufacturer's lines are loaded. */
export function applyEligibleLines(
  special: Special,
  lines: HubLine[]
): Special {
  return {
    ...special,
    eligibleLineIds: lines.slice(0, Math.min(3, lines.length)).map((l) => l.id),
  }
}

export function buildMockNotifications(
  specials: Special[],
  manufacturers: ManufacturerCard[]
): HubNotification[] {
  const nameOf = (id: string) =>
    manufacturers.find((m) => m.org.id === id)?.org.name ?? "Manufacturer"

  const notifs: HubNotification[] = specials.map((s) => ({
    id: `n-${s.id}`,
    kind: "special",
    manufacturerName: nameOf(s.manufacturerOrgId),
    title: s.headline,
    body: `Ends ${new Date(s.endsOn).toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    unread: true,
    specialId: s.id,
  }))

  // A couple of plain "what's new" notifications so the panel looks alive.
  for (const m of manufacturers.slice(0, 2)) {
    notifs.push({
      id: `n-pb-${m.org.id}`,
      kind: "info",
      manufacturerName: m.org.name,
      title: "New price book uploaded",
      body: "Updated pricing for the current quarter is now available.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      unread: true,
    })
  }
  return notifs
}
