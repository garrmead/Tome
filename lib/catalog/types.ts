export const FILE_TYPES = [
  "datasheet",
  "manual",
  "cad",
  "pricebook",
  "iom",
  "brochure",
  "other",
] as const

export type FileType = (typeof FILE_TYPES)[number]

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  datasheet: "Datasheet",
  manual: "Manual",
  cad: "CAD",
  pricebook: "Price Book",
  iom: "IOM",
  brochure: "Brochure",
  other: "Other",
}

export interface ProductLine {
  id: string
  manufacturer_org_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  product_line_id: string
  manufacturer_org_id: string
  model_number: string
  name: string
  description: string | null
  category: string | null
  specs: Record<string, unknown> | null
  image_urls: string[] | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
}

export interface ProductFile {
  id: string
  product_id: string
  owner_org_id: string
  product_line_id: string | null
  filename: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
  updated_at: string
}

export const PRODUCT_FILES_BUCKET = "product-files"
