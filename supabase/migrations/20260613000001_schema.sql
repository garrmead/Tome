-- =============================================================
-- Tome — full schema
-- =============================================================

-- pgcrypto is needed for gen_random_bytes() in invitation tokens.
-- uuid-ossp is available by default; gen_random_uuid() is built-in Postgres 13+.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE org_type   AS ENUM ('manufacturer', 'distributor');
CREATE TYPE user_role  AS ENUM ('admin', 'member');

-- =============================================================
-- SHARED TRIGGER: updated_at
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================
-- TABLE: organizations
-- =============================================================

CREATE TABLE organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  type        org_type    NOT NULL,
  logo_url    text,
  website     text,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: profiles
-- Extends auth.users 1-to-1; deleted when the auth user is removed.
-- Organization cannot be deleted while a profile still points to it.
-- =============================================================

CREATE TABLE profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name       text        NOT NULL,
  role            user_role   NOT NULL DEFAULT 'member',
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_organization_id_idx ON profiles(organization_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: product_lines
-- Owned by a manufacturer organization; cascades on org delete.
-- =============================================================

CREATE TABLE product_lines (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX product_lines_organization_id_idx ON product_lines(organization_id);

CREATE TRIGGER product_lines_updated_at
  BEFORE UPDATE ON product_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_lines ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: products
-- Full-text search across model_number (A), name (A),
-- description (B), category (C) maintained via trigger.
-- =============================================================

CREATE TABLE products (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id uuid        NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  model_number    text        NOT NULL,
  name            text        NOT NULL,
  description     text,
  category        text,
  specs           jsonb,
  image_urls      text[],
  search_vector   tsvector,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX products_product_line_id_idx    ON products(product_line_id);
CREATE INDEX products_organization_id_idx    ON products(organization_id);
CREATE INDEX products_search_vector_gin_idx  ON products USING GIN(search_vector);

CREATE OR REPLACE FUNCTION products_tsvector_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.model_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name,         '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description,  '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category,     '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_tsvector_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_tsvector_update();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: tags
-- =============================================================

CREATE TABLE tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: product_tags  (junction)
-- =============================================================

CREATE TABLE product_tags (
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id      uuid        NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX product_tags_tag_id_idx ON product_tags(tag_id);

ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: files
-- Full-text on filename; tied to both product and org so either
-- owner or file query can find the row efficiently.
-- =============================================================

CREATE TABLE files (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid        NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename        text        NOT NULL,
  storage_path    text        NOT NULL,
  file_type       text,
  file_size       integer,
  search_vector   tsvector,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX files_product_id_idx         ON files(product_id);
CREATE INDEX files_organization_id_idx    ON files(organization_id);
CREATE INDEX files_search_vector_gin_idx  ON files USING GIN(search_vector);

CREATE OR REPLACE FUNCTION files_tsvector_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.filename, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_tsvector_update
  BEFORE INSERT OR UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION files_tsvector_update();

CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: manufacturer_profiles
-- One extended profile per manufacturer org.
-- =============================================================

CREATE TABLE manufacturer_profiles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  tagline         text,
  about           text,
  contact_email   text,
  contact_phone   text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- The UNIQUE constraint above creates an implicit index; name it explicitly too.
CREATE INDEX manufacturer_profiles_organization_id_idx ON manufacturer_profiles(organization_id);

CREATE TRIGGER manufacturer_profiles_updated_at
  BEFORE UPDATE ON manufacturer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manufacturer_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: access_grants
-- A NULL product_line_id means "all lines from that manufacturer".
-- The unique constraint prevents duplicate grants at the same scope.
-- =============================================================

CREATE TABLE access_grants (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_org_id  uuid        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  distributor_org_id   uuid        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  product_line_id      uuid                 REFERENCES product_lines(id)  ON DELETE CASCADE,
  granted_by           uuid        NOT NULL REFERENCES profiles(id)       ON DELETE RESTRICT,
  expires_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  -- NULL product_line_id = org-wide grant; treated distinctly by NULLS NOT DISTINCT
  UNIQUE NULLS NOT DISTINCT (manufacturer_org_id, distributor_org_id, product_line_id)
);

CREATE INDEX access_grants_manufacturer_org_id_idx ON access_grants(manufacturer_org_id);
CREATE INDEX access_grants_distributor_org_id_idx  ON access_grants(distributor_org_id);
CREATE INDEX access_grants_product_line_id_idx     ON access_grants(product_line_id);
CREATE INDEX access_grants_granted_by_idx          ON access_grants(granted_by);

CREATE TRIGGER access_grants_updated_at
  BEFORE UPDATE ON access_grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: invitations
-- token is a 32-byte hex string generated on insert.
-- expires_at defaults to 7 days from creation.
-- =============================================================

CREATE TABLE invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      uuid        NOT NULL REFERENCES profiles(id)      ON DELETE RESTRICT,
  email           text        NOT NULL,
  role            user_role   NOT NULL DEFAULT 'member',
  token           text        NOT NULL UNIQUE
                                DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX invitations_organization_id_idx ON invitations(organization_id);
CREATE INDEX invitations_invited_by_idx      ON invitations(invited_by);
-- token lookups during accept flow need to be fast
CREATE INDEX invitations_token_idx           ON invitations(token);

CREATE TRIGGER invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- STORAGE: product-files bucket (private)
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-files', 'product-files', false)
ON CONFLICT (id) DO NOTHING;
