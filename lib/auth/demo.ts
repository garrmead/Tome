// Demo / no-login mode. Lets you flip between a generic distributor and a
// generic manufacturer account without ever typing credentials. We reuse the
// seeded demo orgs and sign in as their admin users through the service-role
// admin API, so a *real* Supabase session is created and RLS keeps working
// exactly as in production — nothing is bypassed.

export type DemoRole = "distributor" | "manufacturer"

export const DEMO_PASSWORD = "tome-demo-2026"

export interface DemoIdentity {
  role: DemoRole
  email: string
  fullName: string
  /** Seeded org this user belongs to (from supabase/seed.sql). */
  orgId: string
  orgName: string
  orgSlug: string
  /** Where to land after entering this account. */
  landing: string
}

export const DEMO_IDENTITIES: Record<DemoRole, DemoIdentity> = {
  distributor: {
    role: "distributor",
    email: "carol@supplychaindirect.com",
    fullName: "Carol Okafor",
    orgId: "10000000-0000-0000-0000-000000000003",
    orgName: "SupplyChain Direct",
    orgSlug: "supplychaindirect",
    landing: "/hub",
  },
  manufacturer: {
    role: "manufacturer",
    email: "alice@acme-mfg.com",
    fullName: "Alice Chen",
    orgId: "10000000-0000-0000-0000-000000000001",
    orgName: "Acme Manufacturing",
    orgSlug: "acme-manufacturing",
    landing: "/catalog",
  },
}
