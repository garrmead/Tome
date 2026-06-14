"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { updateProduct } from "@/lib/catalog/actions"
import type { Product } from "@/lib/catalog/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SpecRow {
  key: string
  value: string
}

function specsToRows(specs: Record<string, unknown> | null): SpecRow[] {
  if (!specs) return []
  return Object.entries(specs).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : String(value),
  }))
}

export function ProductDetailsEditor({ product }: { product: Product }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const [modelNumber, setModelNumber] = useState(product.model_number)
  const [name, setName] = useState(product.name)
  const [category, setCategory] = useState(product.category ?? "")
  const [description, setDescription] = useState(product.description ?? "")
  const [rows, setRows] = useState<SpecRow[]>(specsToRows(product.specs))

  const viewRows = specsToRows(product.specs)

  function reset() {
    setModelNumber(product.model_number)
    setName(product.name)
    setCategory(product.category ?? "")
    setDescription(product.description ?? "")
    setRows(specsToRows(product.specs))
  }

  function save() {
    const specs: Record<string, unknown> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (key) specs[key] = row.value
    }
    startTransition(async () => {
      const result = await updateProduct(product.id, {
        model_number: modelNumber,
        name,
        category,
        description,
        specs,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Product saved.")
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Details</CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {editing ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pe-model">Model Number</Label>
                <Input id="pe-model" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-name">Name</Label>
                <Input id="pe-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-category">Category</Label>
                <Input id="pe-category" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-description">Description</Label>
              <Textarea id="pe-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Specs</Label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => j === i ? { ...r, key: e.target.value } : r))
                      }
                    />
                    <Input
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => j === i ? { ...r, value: e.target.value } : r))
                      }
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { key: "", value: "" }])}>
                  <Plus className="h-4 w-4" />
                  Add spec
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { reset(); setEditing(false) }} disabled={pending}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            {product.description && (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            )}
            <div>
              <p className="mb-2 text-sm font-medium">Specs</p>
              {viewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specs added yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spec</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.key}</TableCell>
                        <TableCell>{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
