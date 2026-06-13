-- =============================================================
-- Schema alignment pass
-- Renames columns to match the canonical RLS helper function
-- signatures, restructures access_grants to use a scope model,
-- and adds product_line_id to files for efficient file-access checks.
-- =============================================================

-- ── profiles ──────────────────────────────────────────────────

DROP INDEX IF EXISTS profiles_organization_id_idx;
ALTER TABLE profiles RENAME COLUMN organization_id TO org_id;
CREATE INDEX profiles_org_id_idx ON profiles(org_id);

-- ── product_lines ─────────────────────────────────────────────

DROP INDEX IF EXISTS product_lines_organization_id_idx;
ALTER TABLE product_lines RENAME COLUMN organization_id TO manufacturer_org_id;
CREATE INDEX product_lines_manufacturer_org_id_idx ON product_lines(manufacturer_org_id);

-- ── products ──────────────────────────────────────────────────

DROP INDEX IF EXISTS products_organization_id_idx;
ALTER TABLE products RENAME COLUMN organization_id TO manufacturer_org_id;
CREATE INDEX products_manufacturer_org_id_idx ON products(manufacturer_org_id);

-- ── files ─────────────────────────────────────────────────────

DROP INDEX IF EXISTS files_organization_id_idx;
ALTER TABLE files RENAME COLUMN organization_id TO owner_org_id;
CREATE INDEX files_owner_org_id_idx ON files(owner_org_id);

-- Denormalize product_line_id onto files so has_file_access() can
-- check line-scoped grants without a join to products.
ALTER TABLE files
  ADD COLUMN product_line_id uuid REFERENCES product_lines(id) ON DELETE SET NULL;

-- Backfill from the parent product row.
UPDATE files f
   SET product_line_id = p.product_line_id
  FROM products p
 WHERE p.id = f.product_id;

CREATE INDEX files_product_line_id_idx ON files(product_line_id);

-- ── manufacturer_profiles ─────────────────────────────────────

DROP INDEX IF EXISTS manufacturer_profiles_organization_id_idx;
-- The UNIQUE constraint on the old column name is auto-renamed
-- when the column is renamed; we don't need to drop/recreate it.
ALTER TABLE manufacturer_profiles RENAME COLUMN organization_id TO org_id;
CREATE INDEX manufacturer_profiles_org_id_idx ON manufacturer_profiles(org_id);

-- ── invitations ───────────────────────────────────────────────

DROP INDEX IF EXISTS invitations_organization_id_idx;
ALTER TABLE invitations RENAME COLUMN organization_id TO org_id;
CREATE INDEX invitations_org_id_idx ON invitations(org_id);

-- ── access_grants — full restructure ─────────────────────────
-- Old shape: (manufacturer_org_id, distributor_org_id, product_line_id, granted_by, expires_at)
-- New shape:  (manufacturer_org_id, grantee_org_id, grantee_user_id,
--              scope_type, scope_id, granted_by, revoked_at, expires_at)
-- scope_type ∈ { 'all', 'product_line', 'product', 'file' }
-- scope_id   = NULL when scope_type = 'all', otherwise the FK target uuid

-- 1. Drop old unique constraint and indexes that will change names
ALTER TABLE access_grants
  DROP CONSTRAINT IF EXISTS access_grants_manufacturer_org_id_distributor_org_id_product_l_key;

DROP INDEX IF EXISTS access_grants_distributor_org_id_idx;
DROP INDEX IF EXISTS access_grants_product_line_id_idx;

-- 2. Add the new columns before dropping old ones so we can migrate data
ALTER TABLE access_grants
  ADD COLUMN grantee_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN scope_type       text NOT NULL DEFAULT 'all'
                CHECK (scope_type IN ('all', 'product_line', 'product', 'file')),
  ADD COLUMN scope_id         uuid,
  ADD COLUMN revoked_at       timestamptz;

-- 3. Migrate existing product_line_id rows into the new scope columns
UPDATE access_grants
   SET scope_type = 'product_line',
       scope_id   = product_line_id
 WHERE product_line_id IS NOT NULL;
-- Rows where product_line_id IS NULL already have scope_type = 'all', scope_id = NULL

-- 4. Rename distributor_org_id → grantee_org_id
--    (grantee_org_id can now be NULL when grantee_user_id is set)
ALTER TABLE access_grants RENAME COLUMN distributor_org_id TO grantee_org_id;

-- 5. Relax grantee_org_id NOT NULL so user-level grants are possible
ALTER TABLE access_grants ALTER COLUMN grantee_org_id DROP NOT NULL;

-- 6. Drop the old product_line_id column (data already migrated)
ALTER TABLE access_grants DROP COLUMN product_line_id;

-- 7. Constraint: at least one grantee must be set
ALTER TABLE access_grants
  ADD CONSTRAINT access_grants_grantee_check
  CHECK (grantee_org_id IS NOT NULL OR grantee_user_id IS NOT NULL);

-- 8. New unique constraint: prevent duplicate grants at the same scope
--    NULLS NOT DISTINCT so that two org-wide grants for the same pair
--    still collide even when scope_id IS NULL.
ALTER TABLE access_grants
  ADD CONSTRAINT access_grants_unique_grant
  UNIQUE NULLS NOT DISTINCT
    (manufacturer_org_id, grantee_org_id, grantee_user_id, scope_type, scope_id);

-- 9. Rebuild indexes with corrected names
CREATE INDEX access_grants_grantee_org_id_idx  ON access_grants(grantee_org_id);
CREATE INDEX access_grants_grantee_user_id_idx ON access_grants(grantee_user_id);
CREATE INDEX access_grants_scope_type_idx      ON access_grants(scope_type);
CREATE INDEX access_grants_revoked_at_idx      ON access_grants(revoked_at)
  WHERE revoked_at IS NOT NULL;
