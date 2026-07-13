"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createProgram } from "@/lib/rewards/manufacturer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CreateProgramCard() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Program name is required")
      return
    }
    startTransition(async () => {
      const result = await createProgram(name, description)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Rewards program created.")
      }
    })
  }

  return (
    <div className="flex justify-center mt-16">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Start a rewards program</CardTitle>
          <CardDescription>
            Set GMV milestones for distributor reps and attach a reward to each
            tier. You can pause or edit the program at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="program-name">Program name</Label>
            <Input
              id="program-name"
              placeholder="Summit Rewards"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program-description">Description</Label>
            <Textarea
              id="program-description"
              placeholder="Earn rewards for every dollar of tracked sales."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={pending || !name.trim()}
            className="w-full"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create program
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
