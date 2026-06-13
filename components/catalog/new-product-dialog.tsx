"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createProduct } from "@/lib/catalog/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  model_number: z.string().trim().min(1, "Model number is required"),
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function NewProductDialog({
  lineId,
  variant = "default",
  size = "default",
}: {
  lineId: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function onSubmit(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await createProduct({
        product_line_id: lineId,
        model_number: values.model_number,
        name: values.name,
        category: values.category,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
      reset()
      router.refresh()
      router.push(`/catalog/products/${result.data.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          + New Product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
            <DialogDescription>
              Add a product to this line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="p-model">Model Number</Label>
              <Input id="p-model" {...register("model_number")} />
              {errors.model_number && (
                <p className="text-sm text-destructive">
                  {errors.model_number.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-category">Category</Label>
              <Input id="p-category" {...register("category")} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
