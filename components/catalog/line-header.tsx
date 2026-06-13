"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import { updateProductLine } from "@/lib/catalog/actions"
import type { ProductLine } from "@/lib/catalog/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function LineHeader({ line }: { line: ProductLine }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(line.name)
  const [description, setDescription] = useState(line.description ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await updateProductLine(line.id, { name, description })
      if ("error" in result) {
        setError(result.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function cancel() {
    setName(line.name)
    setDescription(line.description ?? "")
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="line-name">Name</Label>
          <Input
            id="line-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line-description">Description</Label>
          <Textarea
            id="line-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={cancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{line.name}</h1>
        {line.description && (
          <p className="text-muted-foreground">{line.description}</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    </div>
  )
}
