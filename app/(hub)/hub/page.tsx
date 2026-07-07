import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth/get-user"
import { getAccessibleManufacturers } from "@/lib/distributor/queries"
import {
  buildMockNotifications,
  buildMockSpecials,
} from "@/lib/hub/specials"
import { DataHub } from "@/components/hub/data-hub"

export default async function HubPage() {
  // Auth and manufacturer list are independent — run them in parallel so the
  // page isn't a two-step waterfall. RLS keeps the list scoped either way.
  const [{ user, profile, org }, manufacturers] = await Promise.all([
    getUser(),
    getAccessibleManufacturers(),
  ])
  if (!user) redirect("/demo")

  const specials = buildMockSpecials(manufacturers)
  const notifications = buildMockNotifications(specials, manufacturers)

  const contextLabel = `${org?.name ?? "Distributor"} · ${
    org?.type === "distributor" ? "SE-US" : "ALL"
  }`

  return (
    <DataHub
      manufacturers={manufacturers}
      specials={specials}
      notifications={notifications}
      contextLabel={contextLabel.toUpperCase()}
      orgType={org?.type}
      userName={profile?.full_name ?? null}
    />
  )
}
