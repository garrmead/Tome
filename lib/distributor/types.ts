import type { Org } from "@/lib/auth/get-user"
import type { Contact, ManufacturerProfile } from "@/lib/profile/types"
import type { Product, ProductFile, ProductLine } from "@/lib/catalog/types"

/** A manufacturer the current distributor has been granted access to. */
export interface ManufacturerCard {
  org: Org
  /** Logo to display — manufacturer-profile logo wins, org logo is fallback. */
  logo_url: string | null
  tagline: string | null
  /** Count of products this distributor can actually see. */
  product_count: number
  /** Distinct categories across the products this distributor can see. */
  categories: string[]
}

/** Everything needed to render the read-only /m/[slug] manufacturer view. */
export interface ManufacturerView {
  org: Org
  profile: ManufacturerProfile | null
  contacts: Contact[]
  /** True only when the manufacturer enabled price books AND the current
   *  distributor can see at least one pricebook file. */
  show_price_books: boolean
}

export type { Contact, ManufacturerProfile, Product, ProductFile, ProductLine }
