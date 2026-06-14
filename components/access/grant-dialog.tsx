'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, List, Package, File, Check, AlertTriangle, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { searchDistributorOrgs, createGrants } from '@/lib/access/actions'
import type { DistributorOrg, EmailResolution, ScopeType } from '@/lib/access/types'
import type { ProductLine, Product, ProductFile } from '@/lib/catalog/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

interface Props {
  productLines: ProductLine[]
  products: Product[]
  files: ProductFile[]
}

type Step = 1 | 2 | 3 | 4  // 4 = result screen

interface ScopeState {
  type: ScopeType
  selectedIds: string[]
}

const SCOPE_OPTIONS: { type: ScopeType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'all', label: 'Entire catalog', icon: Shield, description: 'All products and files' },
  { type: 'product_line', label: 'Specific product line(s)', icon: List, description: 'One or more product lines' },
  { type: 'product', label: 'Specific product(s)', icon: Package, description: 'Select individual products' },
  { type: 'file', label: 'Specific file(s)', icon: File, description: 'Select individual files' },
]

function StepIndicator({ step }: { step: Step }) {
  const steps = ['Distributor', 'Scope', 'Users']
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
      {steps.map((label, i) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className={cn(
              'font-medium',
              step === i + 1 || (step === 4 && i === 2) ? 'text-foreground' : ''
            )}
          >
            {i + 1} – {label}
          </span>
          {i < steps.length - 1 && <span>·</span>}
        </span>
      ))}
    </div>
  )
}

export function GrantDialog({ productLines, products, files }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DistributorOrg[]>([])
  const [selectedOrg, setSelectedOrg] = useState<DistributorOrg | null>(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2
  const [scope, setScope] = useState<ScopeState>({ type: 'all', selectedIds: [] })
  const [scopeFilter, setScopeFilter] = useState('')

  // Step 3
  const [emailsText, setEmailsText] = useState('')
  const [submitPending, startSubmit] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Step 4 (result)
  const [result, setResult] = useState<{
    grants_created: number
    email_results: EmailResolution[]
  } | null>(null)

  function resetAll() {
    setStep(1)
    setQuery('')
    setSearchResults([])
    setSelectedOrg(null)
    setSearching(false)
    setScope({ type: 'all', selectedIds: [] })
    setScopeFilter('')
    setEmailsText('')
    setSubmitError(null)
    setResult(null)
  }

  // Debounced distributor search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchDistributorOrgs(query)
      setSearching(false)
      if ('data' in res) setSearchResults(res.data)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleSelectOrg(org: DistributorOrg) {
    setSelectedOrg(org)
    setQuery('')
    setSearchResults([])
  }

  function toggleScopeId(id: string) {
    setScope((prev) => {
      const next = new Set(prev.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, selectedIds: [...next] }
    })
  }

  const step2Valid =
    scope.type === 'all' || scope.selectedIds.length > 0

  function handleSubmit() {
    startSubmit(async () => {
      setSubmitError(null)
      const scopes =
        scope.type === 'all'
          ? [{ type: 'all' as ScopeType, id: null }]
          : scope.selectedIds.map((id) => ({ type: scope.type, id }))

      const rawEmails = emailsText
        .split(/[\n,]+/)
        .map((e) => e.trim())
        .filter(Boolean)

      const res = await createGrants({
        grantee_org_id: selectedOrg!.id,
        scopes,
        user_emails: rawEmails.length > 0 ? rawEmails : undefined,
      })

      if ('error' in res) {
        setSubmitError(res.error)
      } else {
        setResult(res.data)
        setStep(4)
      }
    })
  }

  const filteredProducts = products.filter((p) =>
    scopeFilter
      ? p.model_number.toLowerCase().includes(scopeFilter.toLowerCase()) ||
        p.name.toLowerCase().includes(scopeFilter.toLowerCase())
      : true
  )

  const filteredFiles = files.filter((f) =>
    scopeFilter ? f.filename.toLowerCase().includes(scopeFilter.toLowerCase()) : true
  )

  const filteredLines = productLines.filter((l) =>
    scopeFilter ? l.name.toLowerCase().includes(scopeFilter.toLowerCase()) : true
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) resetAll()
      }}
    >
      <DialogTrigger asChild>
        <Button>+ Grant Access</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant Access</DialogTitle>
          <DialogDescription asChild>
            <StepIndicator step={step} />
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Distributor ── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select a distributor org</p>
            {selectedOrg ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{selectedOrg.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrg.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedOrg(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Search by name or slug…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <p className="text-xs text-muted-foreground px-1">Searching…</p>
                )}
                {searchResults.length > 0 && (
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {searchResults.map((org) => (
                      <button
                        key={org.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        onClick={() => handleSelectOrg(org)}
                      >
                        <p className="text-sm font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedOrg}
              >
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: Scope ── */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose access scope</p>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => setScope({ type, selectedIds: [] })}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2.5 flex items-center gap-3 transition-colors',
                    scope.type === type
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Sub-list for product_line / product / file */}
            {scope.type !== 'all' && (
              <div className="space-y-2 mt-1">
                <Input
                  placeholder="Filter…"
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {scope.type === 'product_line' &&
                    filteredLines.map((line) => (
                      <label
                        key={line.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={scope.selectedIds.includes(line.id)}
                          onCheckedChange={() => toggleScopeId(line.id)}
                        />
                        <span className="text-sm">{line.name}</span>
                      </label>
                    ))}
                  {scope.type === 'product' &&
                    filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={scope.selectedIds.includes(product.id)}
                          onCheckedChange={() => toggleScopeId(product.id)}
                        />
                        <span className="text-sm">
                          {product.model_number} – {product.name}
                        </span>
                      </label>
                    ))}
                  {scope.type === 'file' &&
                    filteredFiles.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={scope.selectedIds.includes(file.id)}
                          onCheckedChange={() => toggleScopeId(file.id)}
                        />
                        <span className="text-sm">{file.filename}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!step2Valid}>
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 3: Users ── */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Restrict to specific users (optional)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Leave blank to grant access to everyone in the distributor org.
              </p>
            </div>
            <Textarea
              placeholder={'user@example.com\nother@example.com'}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitPending}>
                {submitPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Grant Access
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {step === 4 && result && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Created {result.grants_created} grant{result.grants_created !== 1 ? 's' : ''}.
            </p>
            {result.email_results.length > 0 && (
              <div className="rounded-md border divide-y">
                {result.email_results.map((r) => (
                  <div key={r.email} className="flex items-start gap-2 px-3 py-2">
                    {r.status === 'granted' ? (
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{r.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.status === 'granted' && 'Access granted directly.'}
                        {r.status === 'invited' && 'Invited to join the org. Access pending.'}
                        {r.status === 'no_org_admin' &&
                          'Could not send invitation (org has no admin).'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  onClick={() => {
                    toast.success(
                      `${result.grants_created} grant${result.grants_created !== 1 ? 's' : ''} created.`
                    )
                    router.refresh()
                    resetAll()
                  }}
                >
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
