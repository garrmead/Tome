"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { toast } from "sonner"

import { addProductTag, removeProductTag } from "@/lib/catalog/actions"
import type { Tag } from "@/lib/catalog/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ProductTags({
  productId,
  tags,
}: {
  productId: string
  tags: Tag[]
}) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [pending, startTransition] = useTransition()

  function add() {
    const name = value.trim()
    if (!name) return
    startTransition(async () => {
      const result = await addProductTag(productId, name)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setValue("")
      router.refresh()
    })
  }

  function remove(tagId: string) {
    startTransition(async () => {
      const result = await removeProductTag(productId, tagId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags yet. Add one below.</p>
          )}
          {tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1">
              {tag.name}
              <button
                type="button"
                onClick={() => remove(tag.id)}
                disabled={pending}
                className="hover:text-foreground"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a tag"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add() }
            }}
          />
          <Button onClick={add} disabled={pending || !value.trim()}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
