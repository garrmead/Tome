-- =============================================================
-- Rewards layer (rep view) + line-level files fix
--
-- Adds four tables:
--   reward_programs      one program per manufacturer
--   reward_tiers         tier ladder (Bronze/Silver/Gold …)
--   distributor_progress GMV + tier per rep (or org rollup)
--   reward_earnings      append-only event log
--
-- All writes to progress/earnings go through SECURITY DEFINER
-- RPCs (log_reward_sale, claim_reward) — there are NO client
-- INSERT/UPDATE policies on those tables, mirroring the
-- lookup_user_by_email precedent. Reads are plain RLS.
-- =============================================================

-- ── Fix: allow line-level files (product_id IS NULL) ─────────
-- seed_hub_mock.sql and the Hub attach files directly to a
-- product line without a product; the original schema still had
-- product_id NOT NULL, which rejects those rows.
ALTER TABLE files ALTER COLUMN product_id DROP NOT NULL;

-- =============================================================
-- TABLE: reward_programs
-- =============================================================

CREATE TABLE reward_programs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_org_id  uuid        NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  description          text,
  active               boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER reward_programs_updated_at
  BEFORE UPDATE ON reward_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE reward_programs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: reward_tiers
-- tier_index is 1-based; 0 in distributor_progress means "no tier yet".
-- =============================================================

CREATE TABLE reward_tiers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid        NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
  tier_index          integer     NOT NULL CHECK (tier_index > 0),
  name                text        NOT NULL,
  threshold_gmv       numeric     NOT NULL CHECK (threshold_gmv >= 0),
  reward_title        text        NOT NULL,
  reward_description  text,
  reward_image_url    text,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, tier_index)
);

CREATE INDEX reward_tiers_program_id_idx ON reward_tiers(program_id);

ALTER TABLE reward_tiers ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: distributor_progress
-- user_id set   → rep-level progress (the normal case)
-- user_id NULL  → org-level rollup (reserved for later)
-- =============================================================

CREATE TABLE distributor_progress (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid        NOT NULL REFERENCES reward_programs(id)  ON DELETE CASCADE,
  distributor_org_id  uuid        NOT NULL REFERENCES organizations(id)    ON DELETE CASCADE,
  user_id             uuid                 REFERENCES profiles(id)         ON DELETE CASCADE,
  current_gmv         numeric     NOT NULL DEFAULT 0 CHECK (current_gmv >= 0),
  current_tier_index  integer     NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (program_id, distributor_org_id, user_id)
);

CREATE INDEX distributor_progress_program_org_idx
  ON distributor_progress(program_id, distributor_org_id);

ALTER TABLE distributor_progress ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: reward_earnings  (append-only)
-- =============================================================

CREATE TABLE reward_earnings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid        NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
  distributor_org_id  uuid        NOT NULL REFERENCES organizations(id)   ON DELETE CASCADE,
  user_id             uuid                 REFERENCES profiles(id)        ON DELETE CASCADE,
  event_type          text        NOT NULL
                        CHECK (event_type IN ('tier_crossed', 'sale_logged', 'reward_claimed')),
  tier_index          integer,
  gmv_delta           numeric,
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX reward_earnings_program_user_idx
  ON reward_earnings(program_id, user_id, created_at DESC);

ALTER TABLE reward_earnings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- POLICIES
-- Reads only; all progress/earnings writes go through the RPCs.
-- =============================================================

-- reward_programs
CREATE POLICY "mfr manages own program" ON reward_programs FOR ALL USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "distributors read active programs" ON reward_programs FOR SELECT USING (
  active AND has_manufacturer_access(manufacturer_org_id)
);

-- reward_tiers
CREATE POLICY "mfr manages own tiers" ON reward_tiers FOR ALL USING (
  EXISTS (
    SELECT 1 FROM reward_programs rp
    WHERE rp.id = program_id AND rp.manufacturer_org_id = current_org_id()
  )
);
CREATE POLICY "distributors read tiers" ON reward_tiers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM reward_programs rp
    WHERE rp.id = program_id
      AND rp.active
      AND has_manufacturer_access(rp.manufacturer_org_id)
  )
);

-- distributor_progress — own-org rows power the leaderboard;
-- manufacturers see all progress in their own program.
CREATE POLICY "distributor reads own org progress" ON distributor_progress FOR SELECT USING (
  distributor_org_id = current_org_id()
);
CREATE POLICY "mfr reads own program progress" ON distributor_progress FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM reward_programs rp
    WHERE rp.id = program_id AND rp.manufacturer_org_id = current_org_id()
  )
);

-- reward_earnings
CREATE POLICY "distributor reads own org earnings" ON reward_earnings FOR SELECT USING (
  distributor_org_id = current_org_id()
);
CREATE POLICY "mfr reads own program earnings" ON reward_earnings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM reward_programs rp
    WHERE rp.id = program_id AND rp.manufacturer_org_id = current_org_id()
  )
);

-- =============================================================
-- RPC: log_reward_sale
-- Records a sale for the calling rep, bumps GMV, detects tier
-- crossings, and appends the earnings events — atomically.
-- SECURITY DEFINER because progress/earnings have no write policies.
-- =============================================================

CREATE OR REPLACE FUNCTION log_reward_sale(p_program_id uuid, p_gmv_delta numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_program   reward_programs%ROWTYPE;
  v_org       uuid;
  v_prev_gmv  numeric;
  v_prev_tier integer;
  v_new_gmv   numeric;
  v_new_tier  integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_org := current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization for current user';
  END IF;

  SELECT * INTO v_program FROM reward_programs WHERE id = p_program_id;
  IF NOT FOUND OR NOT v_program.active THEN
    RAISE EXCEPTION 'Reward program not found or inactive';
  END IF;

  IF NOT has_manufacturer_access(v_program.manufacturer_org_id) THEN
    RAISE EXCEPTION 'No access to this manufacturer';
  END IF;

  IF p_gmv_delta IS NULL OR p_gmv_delta <= 0 OR p_gmv_delta > 10000000 THEN
    RAISE EXCEPTION 'Sale amount must be between 0 and 10,000,000';
  END IF;

  -- Ensure a progress row exists, then lock it for the update.
  INSERT INTO distributor_progress (program_id, distributor_org_id, user_id)
  VALUES (p_program_id, v_org, auth.uid())
  ON CONFLICT (program_id, distributor_org_id, user_id) DO NOTHING;

  SELECT current_gmv, current_tier_index INTO v_prev_gmv, v_prev_tier
  FROM distributor_progress
  WHERE program_id = p_program_id
    AND distributor_org_id = v_org
    AND user_id = auth.uid()
  FOR UPDATE;

  v_new_gmv := v_prev_gmv + p_gmv_delta;

  SELECT COALESCE(MAX(tier_index), 0) INTO v_new_tier
  FROM reward_tiers
  WHERE program_id = p_program_id AND threshold_gmv <= v_new_gmv;

  -- Tiers never go backwards.
  v_new_tier := GREATEST(v_new_tier, v_prev_tier);

  UPDATE distributor_progress
     SET current_gmv = v_new_gmv,
         current_tier_index = v_new_tier,
         updated_at = NOW()
   WHERE program_id = p_program_id
     AND distributor_org_id = v_org
     AND user_id = auth.uid();

  INSERT INTO reward_earnings (program_id, distributor_org_id, user_id, event_type, gmv_delta)
  VALUES (p_program_id, v_org, auth.uid(), 'sale_logged', p_gmv_delta);

  IF v_new_tier > v_prev_tier THEN
    INSERT INTO reward_earnings (program_id, distributor_org_id, user_id, event_type, tier_index)
    VALUES (p_program_id, v_org, auth.uid(), 'tier_crossed', v_new_tier);
  END IF;

  RETURN jsonb_build_object(
    'previous_gmv',        v_prev_gmv,
    'new_gmv',             v_new_gmv,
    'previous_tier_index', v_prev_tier,
    'new_tier_index',      v_new_tier
  );
END;
$$;

-- =============================================================
-- RPC: claim_reward
-- No-op fulfillment for now: validates the rep actually holds the
-- tier and appends a reward_claimed event (once per tier).
-- =============================================================

CREATE OR REPLACE FUNCTION claim_reward(p_program_id uuid, p_tier_index integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org  uuid;
  v_tier integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_org := current_org_id();

  SELECT current_tier_index INTO v_tier
  FROM distributor_progress
  WHERE program_id = p_program_id
    AND distributor_org_id = v_org
    AND user_id = auth.uid();

  IF v_tier IS NULL OR v_tier < p_tier_index THEN
    RAISE EXCEPTION 'Tier not reached';
  END IF;

  IF EXISTS (
    SELECT 1 FROM reward_earnings
    WHERE program_id = p_program_id
      AND user_id = auth.uid()
      AND event_type = 'reward_claimed'
      AND tier_index = p_tier_index
  ) THEN
    RETURN; -- already claimed; idempotent
  END IF;

  INSERT INTO reward_earnings (program_id, distributor_org_id, user_id, event_type, tier_index)
  VALUES (p_program_id, v_org, auth.uid(), 'reward_claimed', p_tier_index);
END;
$$;
