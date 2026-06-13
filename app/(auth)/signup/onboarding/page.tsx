'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Factory, Truck } from 'lucide-react'
import { createOrg } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  full_name: z.string().min(1, 'Your name is required'),
})

type FormValues = z.infer<typeof schema>

export default function OnboardingPage() {
  const [orgType, setOrgType] = useState<'manufacturer' | 'distributor' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    if (!orgType) return
    setError(null)
    setIsPending(true)
    const formData = new FormData()
    formData.set('name', values.name)
    formData.set('full_name', values.full_name)
    formData.set('type', orgType)
    const result = await createOrg(formData)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    }
  }

  if (!orgType) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Tome</h1>
          <p className="text-sm text-muted-foreground">Tell us about your organization</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setOrgType('manufacturer')}
            className="rounded-xl border bg-card p-6 text-left hover:border-primary hover:shadow-sm transition-all space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Factory className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Manufacturer</p>
              <p className="text-xs text-muted-foreground mt-1">I make or produce products</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOrgType('distributor')}
            className="rounded-xl border bg-card p-6 text-left hover:border-primary hover:shadow-sm transition-all space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Truck className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Distributor</p>
              <p className="text-xs text-muted-foreground mt-1">I distribute or resell products</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOrgType(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your organization</h1>
        <p className="text-sm text-muted-foreground">
          You selected:{' '}
          <span className="font-medium text-foreground capitalize">{orgType}</span>
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="org-name">
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Acme Corp"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="full-name">
            Your full name
          </label>
          <input
            id="full-name"
            type="text"
            autoComplete="name"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Jane Smith"
            {...form.register('full_name')}
          />
          {form.formState.errors.full_name && (
            <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? 'Creating...' : 'Create organization'}
        </button>
      </form>
    </div>
  )
}
