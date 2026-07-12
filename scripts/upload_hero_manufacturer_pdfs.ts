/**
 * Upload real Gorman-Rupp PDFs into Supabase Storage and register them as
 * `files` rows so the Hub previews real documents instead of metadata-only
 * seed rows.
 *
 * Usage:
 *   1. Drop PDFs into ./demo_assets/gorman-rupp/  (see the README there for
 *      the naming convention: <line>__<type>__<Anything>.pdf)
 *   2. Run:  npx tsx scripts/upload_hero_manufacturer_pdfs.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — read from
 * the environment or .env.local. Idempotent: re-running overwrites the
 * storage object and updates the existing files row (matched on
 * storage_path) instead of duplicating it.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import { join, resolve } from "path"
import { createClient } from "@supabase/supabase-js"

const ASSETS_DIR = resolve(__dirname, "..", "demo_assets", "gorman-rupp")
const BUCKET = "product-files"

const GR_ORG_ID = "10000000-0000-0000-0000-000000000005"

// Line slugs (filename prefix) → seeded product_line ids from seed_rewards.sql
const LINES: Record<string, string> = {
  "super-t": "30000000-0000-0000-0000-000000000007",
  "ultra-v": "30000000-0000-0000-0000-000000000008",
  "10-series": "30000000-0000-0000-0000-000000000009",
  reliasource: "30000000-0000-0000-0000-00000000000a",
}

const FILE_TYPES = new Set([
  "datasheet",
  "manual",
  "cad",
  "pricebook",
  "iom",
  "brochure",
  "other",
])

/** Minimal .env.local loader so the script needs no extra dependency. */
function loadEnvLocal() {
  const path = resolve(__dirname, "..", ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (env or .env.local)."
    )
    process.exit(1)
  }

  if (!existsSync(ASSETS_DIR)) {
    console.error(`No assets directory at ${ASSETS_DIR}.`)
    console.error("Create it and drop PDFs in — see demo_assets/gorman-rupp/README.md.")
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Sanity check: the seed must have been run first.
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", GR_ORG_ID)
    .maybeSingle()
  if (orgErr || !org) {
    console.error(
      "Gorman-Rupp org not found — run supabase/seed_rewards.sql first."
    )
    process.exit(1)
  }

  const pdfs = readdirSync(ASSETS_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  )
  if (pdfs.length === 0) {
    console.log(`No PDFs found in ${ASSETS_DIR} — nothing to do.`)
    return
  }

  let uploaded = 0
  let skipped = 0

  for (const filename of pdfs) {
    // Convention: <line>__<type>__<Anything>.pdf
    const parts = filename.replace(/\.pdf$/i, "").split("__")
    const lineSlug = parts[0]?.toLowerCase()
    const fileType = parts[1]?.toLowerCase()

    const lineId = LINES[lineSlug]
    if (!lineId) {
      console.warn(
        `SKIP ${filename} — unknown line prefix "${lineSlug}". ` +
          `Expected one of: ${Object.keys(LINES).join(", ")}`
      )
      skipped++
      continue
    }
    if (!fileType || !FILE_TYPES.has(fileType)) {
      console.warn(
        `SKIP ${filename} — unknown file type "${fileType}". ` +
          `Expected one of: ${[...FILE_TYPES].join(", ")}`
      )
      skipped++
      continue
    }

    const fullPath = join(ASSETS_DIR, filename)
    const bytes = readFileSync(fullPath)
    const size = statSync(fullPath).size
    // Storage path convention starts with the org id so the existing storage
    // RLS policies ({org_id}/… folder ownership) apply unchanged.
    const storagePath = `${GR_ORG_ID}/${lineSlug}/${filename}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true })
    if (upErr) {
      console.error(`FAIL ${filename} — storage upload: ${upErr.message}`)
      skipped++
      continue
    }

    // Upsert the files row, keyed by storage_path.
    const { data: existing } = await supabase
      .from("files")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle()

    const row = {
      product_id: null,
      owner_org_id: GR_ORG_ID,
      product_line_id: lineId,
      filename,
      storage_path: storagePath,
      file_type: fileType,
      file_size: size,
    }

    const { error: rowErr } = existing
      ? await supabase.from("files").update(row).eq("id", existing.id)
      : await supabase.from("files").insert(row)

    if (rowErr) {
      console.error(`FAIL ${filename} — files row: ${rowErr.message}`)
      skipped++
      continue
    }

    console.log(`OK   ${filename} → ${storagePath} (${fileType}, ${size} bytes)`)
    uploaded++
  }

  console.log(`\nDone. ${uploaded} uploaded, ${skipped} skipped.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
