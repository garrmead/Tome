-- =============================================================
-- Tome — Gorman-Rupp hero manufacturer + Summit Rewards program
-- Run AFTER migrations (including 20260712000001_rewards.sql).
--
-- Creates:
--   • Gorman-Rupp manufacturer org, admin user + profile,
--     manufacturer profile with contacts, 4 product lines
--   • An org-wide access grant to the demo distributor
--     (SupplyChain Direct)
--   • 4 additional SupplyChain Direct reps (auth users +
--     profiles) so the leaderboard has real rows
--   • "Summit Rewards" program with 3 tiers
--     (Bronze $50K / Silver $150K / Gold $500K)
--   • Progress + earnings history for the demo rep (Carol)
--
-- PDFs are uploaded separately via
--   scripts/upload_hero_manufacturer_pdfs.ts
--
-- Idempotent: safe to re-run.
-- =============================================================

DO $$
DECLARE
  org_gr      uuid := '10000000-0000-0000-0000-000000000005';
  org_supply  uuid := '10000000-0000-0000-0000-000000000003';

  user_grace  uuid := '20000000-0000-0000-0000-000000000005'; -- admin @ Gorman-Rupp
  user_carol  uuid := '20000000-0000-0000-0000-000000000003'; -- demo rep @ SupplyChain Direct

  -- Extra SupplyChain Direct reps (leaderboard)
  user_marcus uuid := '20000000-0000-0000-0000-000000000006';
  user_dana   uuid := '20000000-0000-0000-0000-000000000007';
  user_tom    uuid := '20000000-0000-0000-0000-000000000008';
  user_priya  uuid := '20000000-0000-0000-0000-000000000009';

  -- Gorman-Rupp product lines
  pl_supert   uuid := '30000000-0000-0000-0000-000000000007';
  pl_ultrav   uuid := '30000000-0000-0000-0000-000000000008';
  pl_10series uuid := '30000000-0000-0000-0000-000000000009';
  pl_relia    uuid := '30000000-0000-0000-0000-00000000000a';

  program_gr  uuid := '70000000-0000-0000-0000-000000000001';
  tier_bronze uuid := '71000000-0000-0000-0000-000000000001';
  tier_silver uuid := '71000000-0000-0000-0000-000000000002';
  tier_gold   uuid := '71000000-0000-0000-0000-000000000003';

BEGIN

-- =============================================================
-- 1. Auth users (Gorman-Rupp admin + SupplyChain Direct reps)
-- =============================================================
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (user_grace, 'authenticated', 'authenticated',
   'grace@gormanrupp.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_marcus, 'authenticated', 'authenticated',
   'marcus.webb@supplychaindirect.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_dana, 'authenticated', 'authenticated',
   'dana.ruiz@supplychaindirect.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_tom, 'authenticated', 'authenticated',
   'tom.callahan@supplychaindirect.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_priya, 'authenticated', 'authenticated',
   'priya.nair@supplychaindirect.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 2. Gorman-Rupp org, profiles, product lines, grant
-- =============================================================
INSERT INTO organizations (id, name, slug, type) VALUES
  (org_gr, 'Gorman-Rupp', 'gorman-rupp', 'manufacturer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, org_id, full_name, role) VALUES
  (user_grace,  org_gr,     'Grace Hollis',  'admin'),
  (user_marcus, org_supply, 'Marcus Webb',   'member'),
  (user_dana,   org_supply, 'Dana Ruiz',     'member'),
  (user_tom,    org_supply, 'Tom Callahan',  'member'),
  (user_priya,  org_supply, 'Priya Nair',    'member')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturer_profiles (org_id, tagline, about, contact_email, enable_price_books, contacts)
SELECT org_gr,
       'Pumps built for the toughest jobs since 1933.',
       'Gorman-Rupp designs and manufactures self-priming centrifugal pumps, priming-assisted pumps, and packaged lift stations for municipal, industrial, and construction markets.',
       'distributors@gormanrupp.com',
       true,
       '[
         {"id":"c-gr-1","name":"Ray Delgado","title":"Regional Manager — Southeast",
          "email":"ray.delgado@gormanrupp.com","phone":"419-555-0161","region":"SE-US"},
         {"id":"c-gr-2","name":"Beth Kowalski","title":"Applications Engineer — Municipal",
          "email":"beth.kowalski@gormanrupp.com","phone":"419-555-0184","region":"All"},
         {"id":"c-gr-3","name":"Hank Mercer","title":"Inside Sales — Construction",
          "email":"hank.mercer@gormanrupp.com","phone":"419-555-0102","region":"All"}
       ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM manufacturer_profiles WHERE org_id = org_gr);

INSERT INTO product_lines (id, manufacturer_org_id, name, description) VALUES
  (pl_supert,   org_gr, 'Super T Series',
   'Self-priming centrifugal trash pumps for solids-laden liquids.'),
  (pl_ultrav,   org_gr, 'Ultra V Series',
   'High-pressure self-priming pumps with UltraMate performance upgrades.'),
  (pl_10series, org_gr, '10 Series',
   'Standard self-priming centrifugal pumps for clear and gray water.'),
  (pl_relia,    org_gr, 'ReliaSource Lift Stations',
   'Factory-built, above-ground packaged sewage lift stations.')
ON CONFLICT (id) DO NOTHING;

-- Org-wide grant so the demo distributor sees Gorman-Rupp immediately.
INSERT INTO access_grants (manufacturer_org_id, grantee_org_id, scope_type, scope_id, granted_by)
SELECT org_gr, org_supply, 'all', NULL, user_grace
WHERE EXISTS (SELECT 1 FROM profiles WHERE id = user_grace)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 3. Summit Rewards program + tiers
-- =============================================================
INSERT INTO reward_programs (id, manufacturer_org_id, name, description, active) VALUES
  (program_gr, org_gr, 'Summit Rewards',
   'Annual distributor rep program. GMV on Gorman-Rupp equipment counts toward tier rewards. Program year ends Dec 31.',
   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reward_tiers
  (id, program_id, tier_index, name, threshold_gmv, reward_title, reward_description, reward_image_url)
VALUES
  (tier_bronze, program_gr, 1, 'Bronze', 50000,
   'Yeti Tundra 45 + field gear package',
   'Yeti Tundra 45 cooler with Gorman-Rupp field jacket, cap, and site gear.',
   '/rewards/bronze.svg'),
  (tier_silver, program_gr, 2, 'Silver', 150000,
   'Guided fly-fishing weekend for two',
   'Two nights at a guided fly-fishing lodge near Asheville, NC. Travel included.',
   '/rewards/silver.svg'),
  (tier_gold, program_gr, 3, 'Gold', 500000,
   'Performance driving experience + factory tour',
   'Full-day performance driving school at Barber Motorsports Park, plus a VIP tour of the Mansfield, OH plant.',
   '/rewards/gold.svg')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 4. Progress + history for the demo rep and leaderboard
-- =============================================================
-- Carol (the demo rep): Bronze, $18,240 short of Silver.
INSERT INTO distributor_progress (program_id, distributor_org_id, user_id, current_gmv, current_tier_index)
SELECT program_gr, org_supply, user_carol, 131760, 1
WHERE EXISTS (SELECT 1 FROM profiles WHERE id = user_carol)
ON CONFLICT (program_id, distributor_org_id, user_id) DO NOTHING;

INSERT INTO distributor_progress (program_id, distributor_org_id, user_id, current_gmv, current_tier_index)
SELECT v.program_id, v.org_id, v.user_id, v.gmv, v.tier
FROM (VALUES
  (program_gr, org_supply, user_marcus, 214500::numeric, 2),
  (program_gr, org_supply, user_dana,   167200::numeric, 2),
  (program_gr, org_supply, user_tom,     88400::numeric, 1),
  (program_gr, org_supply, user_priya,   36900::numeric, 0)
) AS v(program_id, org_id, user_id, gmv, tier)
WHERE EXISTS (SELECT 1 FROM profiles WHERE id = v.user_id)
ON CONFLICT (program_id, distributor_org_id, user_id) DO NOTHING;

-- Earnings history for Carol (activity feed). Guarded so re-runs
-- don't duplicate the seeded history.
IF EXISTS (SELECT 1 FROM profiles WHERE id = user_carol)
   AND NOT EXISTS (
     SELECT 1 FROM reward_earnings
     WHERE program_id = program_gr AND user_id = user_carol
   )
THEN
  INSERT INTO reward_earnings
    (program_id, distributor_org_id, user_id, event_type, tier_index, gmv_delta, created_at)
  VALUES
    (program_gr, org_supply, user_carol, 'sale_logged',  NULL, 42300, NOW() - INTERVAL '41 days'),
    (program_gr, org_supply, user_carol, 'sale_logged',  NULL, 11800, NOW() - INTERVAL '30 days'),
    (program_gr, org_supply, user_carol, 'tier_crossed', 1,    NULL,  NOW() - INTERVAL '30 days'),
    (program_gr, org_supply, user_carol, 'sale_logged',  NULL, 28460, NOW() - INTERVAL '18 days'),
    (program_gr, org_supply, user_carol, 'sale_logged',  NULL, 49200, NOW() - INTERVAL '3 days');
END IF;

END $$;
