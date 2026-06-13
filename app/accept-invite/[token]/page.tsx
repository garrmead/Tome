import { getInvitation } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'
import AcceptButton from './accept-button'

interface Props {
  params: { token: string }
}

export default async function AcceptInvitePage({ params }: Props) {
  const invitation = await getInvitation(params.token)

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-xl border bg-card p-6 max-w-md w-full text-center space-y-2">
          <h1 className="text-xl font-semibold">Invalid invitation</h1>
          <p className="text-sm text-muted-foreground">
            This invitation link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  if (invitation.accepted_at || new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-xl border bg-card p-6 max-w-md w-full text-center space-y-2">
          <h1 className="text-xl font-semibold">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {invitation.accepted_at
              ? 'This invitation has already been accepted.'
              : 'This invitation has expired.'}
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const orgName = (invitation.organizations as any)?.name ?? 'an organization'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="rounded-xl border bg-card p-6 max-w-md w-full space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">You&apos;ve been invited</h1>
          <p className="text-sm text-muted-foreground">
            Join <span className="font-medium text-foreground">{orgName}</span> on Tome
          </p>
        </div>

        {!user ? (
          <div className="text-center">
            <a
              href={`/login?next=/accept-invite/${params.token}`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Sign in to accept
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href={`/signup?next=/accept-invite/${params.token}`} className="underline">
                Sign up
              </a>
            </p>
          </div>
        ) : (
          <AcceptButton token={params.token} />
        )}
      </div>
    </div>
  )
}
