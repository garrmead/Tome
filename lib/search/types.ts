export interface SearchManufacturer {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export interface SearchLine {
  id: string
  name: string
  description: string | null
  manufacturer_org_id: string
}

export interface SearchProduct {
  id: string
  model_number: string
  name: string
  category: string | null
  manufacturer_org_id: string
  product_line_id: string
}

export interface SearchFile {
  id: string
  filename: string
  file_type: string | null
  file_size: number | null
  product_id: string
  owner_org_id: string
  product_line_id: string | null
}

export interface OrgMeta {
  name: string
  slug: string
}

export interface SearchResults {
  manufacturers: SearchManufacturer[]
  lines: SearchLine[]
  products: SearchProduct[]
  files: SearchFile[]
  /** Keyed by org id; enriches lines/products/files with manufacturer name/slug */
  orgMap: Record<string, OrgMeta>
}

export interface SearchFilters {
  categories: string[]
  manufacturers: { id: string; name: string }[]
}
