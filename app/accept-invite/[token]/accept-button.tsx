'use client'

import { useState } from 'react'
import { acceptInvitation } from '@/lib/auth/actions'

export default function AcceptButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleAccept() {
    setError(null)
    setIsPending(true)
    const result = await acceptInvitation(token)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-3 text-center">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? 'Accepting...' : 'Accept invitation'}
      </button>
    </div>
  )
}
