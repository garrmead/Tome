import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"
import { RfqStatusSelect } from "@/components/rfq/rfq-status-select"
import type { RfqStatus } from "@/lib/rfq/types"

interface RfqRow {
  id: string
  distributor_org_id: string
  status: RfqStatus
  note: string | null
  created_at: string
}

interface ItemRow {
  rfq_id: string
  product_line_id: string
  quantity: number
  note: string | null
}

export default async function RfqQueuePage() {
  const { user, org } = await getUser()
  if (!user) redirect("/login")
  if (org?.type !== "manufacturer") redirect("/dashboard")

  const supabase = await createClient()

  // RLS scopes rfqs to this manufacturer; org names come through the
  // "mfr sees granted distributors" policy.
  const [{ data: rfqs }, { data: items }, { data: orgs }, { data: lines }] =
    await Promise.all([
      supabase
        .from("rfqs")
        .select("id, distributor_org_id, status, note, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("rfq_items").select("rfq_id, product_line_id, quantity, note"),
      supabase.from("organizations").select("id, name"),
      supabase.from("product_lines").select("id, name"),
    ])

  const orgName = new Map(
    ((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name])
  )
  const lineName = new Map(
    ((lines ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name])
  )
  const itemsByRfq = new Map<string, ItemRow[]>()
  for (const item of (items ?? []) as ItemRow[]) {
    if (!itemsByRfq.has(item.rfq_id)) itemsByRfq.set(item.rfq_id, [])
    itemsByRfq.get(item.rfq_id)!.push(item)
  }

  const rows = (rfqs ?? []) as RfqRow[]
  const openCount = rows.filter((r) => r.status === "open").length

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Quote requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RFQs submitted by your distributors from the Hub.
          {openCount > 0 && ` ${openCount} open.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
          No quote requests yet. When a distributor requests a quote from the
          Hub, it lands here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((rfq) => {
            const rfqItems = itemsByRfq.get(rfq.id) ?? []
            return (
              <div key={rfq.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {orgName.get(rfq.distributor_org_id) ?? "Distributor"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(rfq.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {rfqItems.length}{" "}
                      {rfqItems.length === 1 ? "line" : "lines"}
                    </p>
                  </div>
                  <RfqStatusSelect rfqId={rfq.id} status={rfq.status} />
                </div>

                <div className="mt-3 space-y-1.5">
                  {rfqItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">
                        {lineName.get(item.product_line_id) ?? "Product line"}
                      </span>
                      <span className="text-muted-foreground">
                        × {item.quantity}
                      </span>
                      {item.note && (
                        <span className="truncate text-muted-foreground">
                          — {item.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {rfq.note && (
                  <p className="mt-2.5 border-l-2 pl-3 text-xs italic text-muted-foreground">
                    “{rfq.note}”
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
