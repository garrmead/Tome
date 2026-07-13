import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth/get-user"
import { getAccessibleManufacturers } from "@/lib/distributor/queries"
import { getHubNotifications, getLiveSpecials } from "@/lib/hub/queries"
import { DataHub } from "@/components/hub/data-hub"

export default async function HubPage() {
  // All four reads are independent — run them in parallel so the page isn't
  // a waterfall. RLS scopes every one of them to the caller.
  const [{ user, profile, org }, manufacturers, specials, notifications] =
    await Promise.all([
      getUser(),
      getAccessibleManufacturers(),
      getLiveSpecials(),
      getHubNotifications(),
    ])
  if (!user) redirect("/demo")

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
