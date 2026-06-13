'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { logIn, sendMagicLink } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const passwordSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const magicSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type PasswordFormValues = z.infer<typeof passwordSchema>
type MagicFormValues = z.infer<typeof magicSchema>

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'password' | 'magic'>('password')
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  const magicForm = useForm<MagicFormValues>({
    resolver: zodResolver(magicSchema),
  })

  async function onPasswordSubmit(values: PasswordFormValues) {
    setError(null)
    setIsPending(true)
    const formData = new FormData()
    formData.set('email', values.email)
    formData.set('password', values.password)
    const result = await logIn(formData)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    }
  }

  async function onMagicSubmit(values: MagicFormValues) {
    setError(null)
    setIsPending(true)
    const formData = new FormData()
    formData.set('email', values.email)
    const result = await sendMagicLink(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setMagicSent(true)
    }
    setIsPending(false)
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Tome account</p>
      </div>

      <div className="flex rounded-lg bg-muted p-1 gap-1">
        <button
          type="button"
          onClick={() => { setActiveTab('password'); setError(null); setMagicSent(false) }}
          className={cn(
            'flex-1 text-sm font-medium py-1.5 rounded-md transition-colors',
            activeTab === 'password'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('magic'); setError(null); setMagicSent(false) }}
          className={cn(
            'flex-1 text-sm font-medium py-1.5 rounded-md transition-colors',
            activeTab === 'magic'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Magic link
        </button>
      </div>

      {activeTab === 'password' && (
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="you@example.com"
              {...passwordForm.register('email')}
            />
            {passwordForm.formState.errors.email && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="••••••••"
              {...passwordForm.register('password')}
            />
            {passwordForm.formState.errors.password && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
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
            {isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      )}

      {activeTab === 'magic' && (
        <>
          {magicSent ? (
            <div className="rounded-md bg-muted px-4 py-6 text-center space-y-2">
              <p className="font-medium">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                We sent a magic link to your email address.
              </p>
            </div>
          ) : (
            <form onSubmit={magicForm.handleSubmit(onMagicSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="magic-email">
                  Email
                </label>
                <input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="you@example.com"
                  {...magicForm.register('email')}
                />
                {magicForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{magicForm.formState.errors.email.message}</p>
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
                {isPending ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          )}
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
