-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
-- These resolve "does this user have access to this thing?" in one place
-- so policies stay readable and we only have one place to update logic.

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin_of(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND org_id = p_org_id AND role = 'admin'
  )
$$;

-- Has the current user been granted access to any data from this manufacturer?
CREATE OR REPLACE FUNCTION has_manufacturer_access(p_manufacturer_org_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Manufacturer's own members always have access
  IF current_org_id() = p_manufacturer_org_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM access_grants
    WHERE manufacturer_org_id = p_manufacturer_org_id
      AND revoked_at IS NULL
      AND (
        (grantee_user_id IS NULL AND grantee_org_id = current_org_id())
        OR grantee_user_id = auth.uid()
      )
  );
END;
$$;

-- Can the current user see this specific product?
CREATE OR REPLACE FUNCTION has_product_access(p_product_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_mfr uuid; v_line uuid;
BEGIN
  SELECT manufacturer_org_id, product_line_id INTO v_mfr, v_line
  FROM products WHERE id = p_product_id;

  IF current_org_id() = v_mfr THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM access_grants
    WHERE manufacturer_org_id = v_mfr
      AND revoked_at IS NULL
      AND (
        (grantee_user_id IS NULL AND grantee_org_id = current_org_id())
        OR grantee_user_id = auth.uid()
      )
      AND (
        scope_type = 'all'
        OR (scope_type = 'product_line' AND scope_id = v_line)
        OR (scope_type = 'product' AND scope_id = p_product_id)
      )
  );
END;
$$;

-- Can the current user see this file?
CREATE OR REPLACE FUNCTION has_file_access(p_file_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_owner uuid; v_product uuid; v_line uuid;
BEGIN
  SELECT owner_org_id, product_id, product_line_id
    INTO v_owner, v_product, v_line
  FROM files WHERE id = p_file_id;

  IF current_org_id() = v_owner THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM access_grants
    WHERE manufacturer_org_id = v_owner
      AND revoked_at IS NULL
      AND (
        (grantee_user_id IS NULL AND grantee_org_id = current_org_id())
        OR grantee_user_id = auth.uid()
      )
      AND (
        scope_type = 'all'
        OR (scope_type = 'product_line' AND scope_id = v_line)
        OR (scope_type = 'product' AND scope_id = v_product)
        OR (scope_type = 'file'    AND scope_id = p_file_id)
      )
  );
END;
$$;

-- ============================================================
-- POLICIES
-- ============================================================

-- ORGANIZATIONS
-- Users always see their own org. Distributors see manufacturers that
-- granted them anything. (No one sees other distributors.)
CREATE POLICY "own org" ON organizations FOR SELECT USING (
  id = current_org_id()
);
CREATE POLICY "granted manufacturers" ON organizations FOR SELECT USING (
  type = 'manufacturer' AND has_manufacturer_access(id)
);
CREATE POLICY "admins update own org" ON organizations FOR UPDATE USING (
  is_admin_of(id)
);

-- PROFILES
-- Users see profiles in their own org. Manufacturers see profiles of
-- distributors they've granted user-level access to (so they can manage it).
CREATE POLICY "profiles in own org" ON profiles FOR SELECT USING (
  org_id = current_org_id()
);
CREATE POLICY "users update self" ON profiles FOR UPDATE USING (
  id = auth.uid()
);

-- PRODUCT LINES
CREATE POLICY "mfr manages own lines" ON product_lines FOR ALL USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "distributors read lines via grants" ON product_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM access_grants
    WHERE manufacturer_org_id = product_lines.manufacturer_org_id
      AND revoked_at IS NULL
      AND (
        (grantee_user_id IS NULL AND grantee_org_id = current_org_id())
        OR grantee_user_id = auth.uid()
      )
      AND (
        scope_type IN ('all','product')
        OR (scope_type = 'product_line' AND scope_id = product_lines.id)
      )
  )
);

-- PRODUCTS
CREATE POLICY "mfr manages own products" ON products FOR ALL USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "distributors read products" ON products FOR SELECT USING (
  has_product_access(id)
);

-- FILES
CREATE POLICY "mfr manages own files" ON files FOR ALL USING (
  owner_org_id = current_org_id()
);
CREATE POLICY "distributors read files" ON files FOR SELECT USING (
  has_file_access(id)
);

-- ACCESS GRANTS
-- Only manufacturer admins write grants. Grantees can see their own.
CREATE POLICY "mfr admin manages grants" ON access_grants FOR ALL USING (
  is_admin_of(manufacturer_org_id)
);
CREATE POLICY "grantee reads own grants" ON access_grants FOR SELECT USING (
  grantee_user_id = auth.uid() OR grantee_org_id = current_org_id()
);

-- MANUFACTURER PROFILES
CREATE POLICY "mfr edits own profile" ON manufacturer_profiles FOR ALL USING (
  org_id = current_org_id()
);
CREATE POLICY "distributors read mfr profile" ON manufacturer_profiles FOR SELECT
USING (
  has_manufacturer_access(org_id)
);

-- INVITATIONS
CREATE POLICY "admins manage invites" ON invitations FOR ALL USING (
  is_admin_of(org_id)
);

-- ============================================================
-- STORAGE POLICIES (run in storage schema)
-- ============================================================
-- Bucket: product-files. Path convention: {org_id}/{product_id}/{filename}

CREATE POLICY "mfr uploads to own folder" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-files'
  AND (storage.foldername(name))[1] = current_org_id()::text
);

CREATE POLICY "mfr manages own files in storage" ON storage.objects FOR ALL
USING (
  bucket_id = 'product-files'
  AND (storage.foldername(name))[1] = current_org_id()::text
);

CREATE POLICY "users read files via grants" ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-files'
  AND EXISTS (
    SELECT 1 FROM files
    WHERE files.storage_path = storage.objects.name
      AND has_file_access(files.id)
  )
);
