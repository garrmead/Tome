'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { revokeGrants } from '@/lib/access/actions'
import type { GrantWithDetails } from '@/lib/access/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

interface Props {
  grants: GrantWithDetails[]
}

export function GrantsTable({ grants }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revoking, setRevoking] = useState<string | null>(null)
  const [bulkPending, startBulkTransition] = useTransition()

  if (grants.length === 0) {
    return (
      <div className="flex justify-center mt-16">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-3 text-center">
            <ShieldOff className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No active grants</p>
            <p className="text-sm text-muted-foreground">
              Use &quot;+ Grant Access&quot; to share your catalog with distributors.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allIds = grants.map((g) => g.id)
  const allChecked = allIds.every((id) => selected.has(id))
  const someChecked = selected.size > 0

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds))
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function doRevoke(ids: string[]) {
    const result = await revokeGrants(ids)
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    return true
  }

  async function handleSingleRevoke(id: string) {
    setRevoking(id)
    const ok = await doRevoke([id])
    setRevoking(null)
    if (ok) {
      toast.success('Grant revoked.')
      router.refresh()
    }
  }

  function handleBulkRevoke() {
    const ids = [...selected]
    startBulkTransition(async () => {
      const ok = await doRevoke(ids)
      if (ok) {
        toast.success(`${ids.length} grant${ids.length > 1 ? 's' : ''} revoked.`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {someChecked && (
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleBulkRevoke} disabled={bulkPending}>
            {bulkPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Revoke selected ({selected.size})
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Distributor</TableHead>
              <TableHead>User restriction</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Granted by</TableHead>
              <TableHead>Granted at</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.map((grant) => (
              <TableRow key={grant.id} data-state={selected.has(grant.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox checked={selected.has(grant.id)} onCheckedChange={() => toggleRow(grant.id)} aria-label={`Select grant ${grant.id}`} />
                </TableCell>
                <TableCell>{grant.grantee_org?.name ?? (grant.grantee_user_id ? 'Specific user' : '—')}</TableCell>
                <TableCell>{grant.grantee_user_profile?.full_name ?? 'Entire org'}</TableCell>
                <TableCell>{grant.scope_label}</TableCell>
                <TableCell>{grant.grantor_profile?.full_name ?? '—'}</TableCell>
                <TableCell>{new Date(grant.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleSingleRevoke(grant.id)}
                    disabled={revoking === grant.id}
                  >
                    {revoking === grant.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revoke'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
