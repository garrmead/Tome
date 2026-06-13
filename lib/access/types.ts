export type ScopeType = "all" | "product_line" | "product" | "file"

export const SCOPE_LABELS: Record<ScopeType, string> = {
  all: "Entire catalog",
  product_line: "Product line",
  product: "Product",
  file: "File",
}

export interface AccessGrant {
  id: string
  manufacturer_org_id: string
  grantee_org_id: string | null
  grantee_user_id: string | null
  scope_type: ScopeType
  scope_id: string | null
  granted_by: string
  revoked_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface GrantWithDetails extends AccessGrant {
  grantee_org: { id: string; name: string; slug: string } | null
  grantee_user_profile: { id: string; full_name: string } | null
  grantor_profile: { id: string; full_name: string } | null
  scope_label: string
}

export interface DistributorOrg {
  id: string
  name: string
  slug: string
}

/** A single scope target chosen in step 2 of the grant wizard */
export interface ScopeSelection {
  type: ScopeType
  /** null when type === 'all', otherwise the FK target uuid */
  id: string | null
  label: string
}

/** Result of resolving an email address for user-level grants */
export interface EmailResolution {
  email: string
  /** "granted" = user found in org, user-level grant created
   *  "invited" = user not in org, invitation created
   *  "no_org_admin" = could not create invitation (no admin found in grantee org) */
  status: "granted" | "invited" | "no_org_admin"
  user_id?: string
}
