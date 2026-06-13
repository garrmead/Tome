-- =============================================================
-- Manufacturer profile extended fields + org-assets storage bucket
-- =============================================================

-- Add columns the profile editor needs
ALTER TABLE manufacturer_profiles
  ADD COLUMN IF NOT EXISTS logo_url        text,
  ADD COLUMN IF NOT EXISTS contacts        jsonb        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS org_chart_url   text,
  ADD COLUMN IF NOT EXISTS enable_price_books boolean NOT NULL DEFAULT false;

-- Helper RPC: look up a user and their org by email.
-- SECURITY DEFINER so it can query auth.users even when called via anon role.
-- Used by the access-grant wizard to resolve email addresses to user/org pairs.
CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email text)
RETURNS TABLE (user_id uuid, profile_org_id uuid)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.id AS user_id, p.org_id AS profile_org_id
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1
$$;

-- org-assets bucket: logos, org charts.
-- Public=true so logos render without auth-gated signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Org members manage files under their own org folder.
-- Path convention: {org_id}/logo.{ext}  |  {org_id}/org-chart.{ext}
CREATE POLICY "org manages own assets" ON storage.objects FOR ALL
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = current_org_id()::text
)
WITH CHECK (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = current_org_id()::text
);
-- Public bucket → SELECT is open; no read policy needed.
