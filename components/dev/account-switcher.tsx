'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { enterDemo } from '@/lib/auth/actions'
import type { DemoRole } from '@/lib/auth/demo'
import { cn } from '@/lib/utils'

/**
 * Demo-only account toggle in the header. Flips between the generic
 * distributor and manufacturer accounts without a login form.
 */
export function AccountSwitcher({ current }: { current?: 'manufacturer' | 'distributor' }) {
  const [pending, startTransition] = useTransition()

  function go(role: DemoRole) {
    if (role === current) return
    startTransition(async () => {
      await enterDemo(role)
    })
  }

  return (
    <div className="hidden items-center rounded-md border p-0.5 sm:flex">
      {pending && <Loader2 className="ml-1 mr-1 h-3 w-3 animate-spin text-muted-foreground" />}
      {(['distributor', 'manufacturer'] as DemoRole[]).map((role) => (
        <button
          key={role}
          onClick={() => go(role)}
          disabled={pending}
          className={cn(
            'rounded px-2 py-1 text-xs capitalize transition-colors',
            current === role
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {role}
        </button>
      ))}
    </div>
  )
}
