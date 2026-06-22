import type { Contact } from "@/lib/profile/types"
import type { ProductFile, ProductLine } from "@/lib/catalog/types"
import type { ManufacturerCard } from "@/lib/distributor/types"

export interface HubLine extends ProductLine {
  product_count: number
  file_count: number
  files: ProductFile[]
}

export interface HubManufacturerData {
  lines: HubLine[]
  contacts: Contact[]
  pricebooks: ProductFile[]
  cheatsheets: ProductFile[]
  logo_url: string | null
  tagline: string | null
}

export interface Special {
  id: string
  manufacturerOrgId: string
  label: string
  headline: string
  endsOn: string
  eligibleLineIds: string[]
  termsUrl: string
}

export interface HubNotification {
  id: string
  kind: "special" | "info"
  manufacturerName: string
  title: string
  body: string
  createdAt: string
  unread: boolean
  specialId?: string
}

export type { ManufacturerCard }
