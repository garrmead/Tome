"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateRfqStatus } from "@/lib/rfq/actions"
import { RFQ_STATUSES, type RfqStatus } from "@/lib/rfq/types"

export function RfqStatusSelect({
  rfqId,
  status,
}: {
  rfqId: string
  status: RfqStatus
}) {
  const [pending, startUpdate] = useTransition()

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) =>
        startUpdate(async () => {
          const res = await updateRfqStatus(rfqId, v as RfqStatus)
          if ("error" in res) toast.error(res.error)
          else toast.success(`RFQ marked ${v}`)
        })
      }
    >
      <SelectTrigger className="h-8 w-[120px] text-xs capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RFQ_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs capitalize">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
