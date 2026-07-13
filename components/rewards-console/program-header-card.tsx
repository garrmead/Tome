"use client"

import { useTransition } from "react"
import { Loader2, Pause, Play } from "lucide-react"
import { toast } from "sonner"

import { updateProgram } from "@/lib/rewards/manufacturer"
import type { ConsoleProgram } from "@/lib/rewards/manufacturer-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function ProgramHeaderCard({ program }: { program: ConsoleProgram }) {
  const [pending, startTransition] = useTransition()

  function toggleActive() {
    startTransition(async () => {
      const result = await updateProgram(program.id, { active: !program.active })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(program.active ? "Program paused." : "Program resumed.")
      }
    })
  }

  const createdDate = new Date(program.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Card>
      <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold truncate">{program.name}</h2>
            {program.active ? (
              <Badge className="bg-[#2f6ea3] hover:bg-[#2f6ea3] text-white">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Paused</Badge>
            )}
          </div>
          {program.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {program.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Created {createdDate}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleActive}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : program.active ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {program.active ? "Pause program" : "Resume program"}
        </Button>
      </CardContent>
    </Card>
  )
}
