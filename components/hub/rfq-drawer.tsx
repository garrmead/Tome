"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ACCENT, MONO_LABEL } from "@/components/hub/tokens"
import { createRfq } from "@/lib/rfq/actions"
import type { HubLine } from "@/lib/hub/types"

interface ItemRow {
  lineId: string
  quantity: string
  note: string
}

/**
 * Quote-request drawer. Opens prefilled with the line the rep was looking at;
 * more lines can be added. Submitting notifies the manufacturer's admins.
 */
export function RfqDrawer({
  open,
  onOpenChange,
  manufacturerName,
  manufacturerOrgId,
  lines,
  initialLineId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  manufacturerName: string
  manufacturerOrgId: string
  lines: HubLine[]
  initialLineId: string | null
}) {
  const [items, setItems] = useState<ItemRow[]>([])
  const [note, setNote] = useState("")
  const [pending, startSubmit] = useTransition()

  // Re-prime the form each time the drawer opens.
  useEffect(() => {
    if (open) {
      setItems([
        {
          lineId: initialLineId ?? lines[0]?.id ?? "",
          quantity: "1",
          note: "",
        },
      ])
      setNote("")
    }
  }, [open, initialLineId, lines])

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function submit() {
    startSubmit(async () => {
      const res = await createRfq(
        manufacturerOrgId,
        items.map((i) => ({
          product_line_id: i.lineId,
          quantity: Number(i.quantity),
          note: i.note,
        })),
        note
      )
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Quote request sent to ${manufacturerName}`)
      onOpenChange(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-sans text-base">
            Request a quote — {manufacturerName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <p className={MONO_LABEL}>Lines</p>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={item.lineId}
                onValueChange={(v) => updateItem(i, { lineId: v })}
              >
                <SelectTrigger className="h-9 flex-1 text-xs">
                  <SelectValue placeholder="Product line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                inputMode="numeric"
                className="h-9 w-16 text-center text-xs"
                aria-label="Quantity"
              />
              {items.length > 1 && (
                <button
                  onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() =>
              setItems((rows) => [
                ...rows,
                { lineId: lines[0]?.id ?? "", quantity: "1", note: "" },
              ])
            }
            className={cn(MONO_LABEL, "flex items-center gap-1.5 self-start hover:text-foreground")}
          >
            <Plus className="h-3 w-3" /> Add another line
          </button>

          <p className={cn(MONO_LABEL, "mt-2")}>Notes for the manufacturer</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Project, timeline, spec requirements…"
            className="min-h-[90px] text-xs"
          />
        </div>

        <Button
          disabled={pending || items.length === 0}
          onClick={submit}
          className="font-mono text-xs text-white hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          {pending ? "Sending…" : "Send quote request"}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
