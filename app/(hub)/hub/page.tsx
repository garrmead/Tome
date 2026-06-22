import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth/get-user"
import { getAccessibleManufacturers } from "@/lib/distributor/queries"
import {
  buildMockNotifications,
  buildMockSpecials,
} from "@/lib/hub/specials"
import { DataHub } from "@/components/hub/data-hub"

export default async function HubPage() {
  const { user, profile, org } = await getUser()
  if (!user) redirect("/demo")

  const manufacturers = await getAccessibleManufacturers()
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
