"use server"

import { createClient } from "@/lib/supabase/server"
import { PRODUCT_FILES_BUCKET } from "@/lib/catalog/types"

export interface SignedFile {
  url: string
  filename: string
  file_type: string | null
  file_size: number | null
  updated_at: string
}

type Result<T> = { error: string } | { data: T }

const SIGNED_URL_TTL = 60 * 5 // 5 minutes

/**
 * Mint a short-lived signed URL for a file the caller is allowed to see.
 *
 * Security: this NEVER trusts the client. The file id is re-checked two ways,
 * both bound to the caller's session (RLS in force, no admin client):
 *   1. The `files` row must be selectable — proves DB-level access through
 *      has_file_access().
 *   2. createSignedUrl must succeed under the storage "users read files via
 *      grants" policy — proves storage-level access.
 * If either check fails the caller gets a generic error, never a URL.
 */
export async function getFileSignedUrl(
  fileId: string,
  intent: "preview" | "download" = "preview"
): Promise<Result<SignedFile>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // (1) DB-level access check via RLS.
  const { data: file } = await supabase
    .from("files")
    .select("filename, storage_path, file_type, file_size, updated_at, owner_org_id")
    .eq("id", fileId)
    .maybeSingle()

  if (!file) return { error: "File not found or access denied" }

  // Instrumentation chokepoint: every file open in the product flows through
  // here, so one log_event call covers analytics, notifications, and rewards.
  // Best-effort — a logging failure must never block the signed URL.
  await supabase.rpc("log_event", {
    p_manufacturer_org_id: (file as any).owner_org_id,
    p_event_type: intent === "download" ? "file_download" : "file_preview",
    p_subject_id: fileId,
    p_metadata: { file_type: (file as any).file_type },
  })

  // (2) Storage-level access check — signed URL creation is itself RLS-gated.
  const { data: signed, error: signErr } = await supabase.storage
    .from(PRODUCT_FILES_BUCKET)
    .createSignedUrl((file as any).storage_path, SIGNED_URL_TTL)

  if (signErr || !signed?.signedUrl) {
    return { error: "Could not generate a download link" }
  }

  return {
    data: {
      url: signed.signedUrl,
      filename: (file as any).filename,
      file_type: (file as any).file_type,
      file_size: (file as any).file_size,
      updated_at: (file as any).updated_at,
    },
  }
}
