"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

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
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function add() {
    const name = value.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await addProductTag(productId, name)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setValue("")
      router.refresh()
    })
  }

  function remove(tagId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeProductTag(productId, tagId)
      if ("error" in result) {
        setError(result.error)
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
            <p className="text-sm text-muted-foreground">No tags</p>
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
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button onClick={add} disabled={pending || !value.trim()}>
            Add
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
