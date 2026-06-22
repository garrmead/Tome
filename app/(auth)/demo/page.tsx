'use client'

import { useState } from 'react'
import { Building2, Truck, Loader2 } from 'lucide-react'
import { enterDemo } from '@/lib/auth/actions'
import type { DemoRole } from '@/lib/auth/demo'

export default function DemoPage() {
  const [pending, setPending] = useState<DemoRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(role: DemoRole) {
    setError(null)
    setPending(role)
    const res = await enterDemo(role)
    // On success the action redirects; only errors return here.
    if (res?.error) {
      setError(res.error)
      setPending(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tome demo</h1>
        <p className="text-sm text-muted-foreground">
          Pick an account to explore. No login required — switch anytime from
          the header.
        </p>
      </div>

      <div className="grid gap-3">
        <button
          onClick={() => pick('distributor')}
          disabled={pending !== null}
          className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            {pending === 'distributor' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Truck className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium">Enter as Distributor</p>
            <p className="text-sm text-muted-foreground">
              SupplyChain Direct — browse catalogs in the Hub.
            </p>
          </div>
        </button>

        <button
          onClick={() => pick('manufacturer')}
          disabled={pending !== null}
          className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            {pending === 'manufacturer' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium">Enter as Manufacturer</p>
            <p className="text-sm text-muted-foreground">
              Acme Manufacturing — manage catalog, access, and profile.
            </p>
          </div>
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
