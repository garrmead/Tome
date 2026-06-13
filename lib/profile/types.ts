export interface Contact {
  /** Client-only UUID for React key; not persisted */
  id: string
  name: string
  title: string
  email: string
  phone: string
  region: string
}

export interface ManufacturerProfile {
  id: string
  org_id: string
  tagline: string | null
  about: string | null
  contact_email: string | null
  contact_phone: string | null
  logo_url: string | null
  contacts: Contact[]
  org_chart_url: string | null
  enable_price_books: boolean
  created_at: string
  updated_at: string
}

export const ORG_ASSETS_BUCKET = "org-assets"
