"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { createProductLine } from "@/lib/catalog/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function NewProductLineDialog({
  variant = "default",
  size = "default",
  label = "+ New Product Line",
}: {
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm"
  label?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createProductLine({
        name: values.name,
        description: values.description,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Product line "${values.name}" created.`)
      setOpen(false)
      reset()
      router.refresh()
      router.push(`/catalog/lines/${result.data.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New Product Line</DialogTitle>
            <DialogDescription>
              Create a product line to group related products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pl-name">Name</Label>
              <Input id="pl-name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-description">Description</Label>
              <Textarea id="pl-description" {...register("description")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
