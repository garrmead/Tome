-- =============================================================
-- Tome — live specials seed
-- Run AFTER migrations (incl. 20260713000001_platform.sql) and
-- AFTER seed.sql / seed_rewards.sql, so the grant fan-out
-- triggers can deliver notifications to granted users.
--
-- Idempotent: guarded by headline, safe to re-run.
-- =============================================================

DO $$
DECLARE
  org_gr    uuid := '10000000-0000-0000-0000-000000000005';
  org_acme  uuid := '10000000-0000-0000-0000-000000000001';
  pl_supert uuid := '30000000-0000-0000-0000-000000000007';
  pl_ultrav uuid := '30000000-0000-0000-0000-000000000008';
  pl_hvac   uuid := '30000000-0000-0000-0000-000000000001';
BEGIN

IF EXISTS (SELECT 1 FROM organizations WHERE id = org_gr)
   AND NOT EXISTS (
     SELECT 1 FROM specials
     WHERE manufacturer_org_id = org_gr
       AND headline = 'Q3 stocking program: 6% off Super T and Ultra V orders over $25K'
   )
THEN
  INSERT INTO specials (manufacturer_org_id, label, headline, ends_on, eligible_line_ids, terms_url)
  VALUES (org_gr, 'Q3 PROMO',
          'Q3 stocking program: 6% off Super T and Ultra V orders over $25K',
          CURRENT_DATE + INTERVAL '45 days',
          ARRAY[pl_supert, pl_ultrav],
          'https://example.com/gr-q3-terms');
END IF;

IF EXISTS (SELECT 1 FROM organizations WHERE id = org_acme)
   AND NOT EXISTS (
     SELECT 1 FROM specials
     WHERE manufacturer_org_id = org_acme
       AND headline = 'HVAC controls close-out: 12% off remaining AC-T100 stock'
   )
THEN
  INSERT INTO specials (manufacturer_org_id, label, headline, ends_on, eligible_line_ids)
  VALUES (org_acme, 'CLOSE-OUT',
          'HVAC controls close-out: 12% off remaining AC-T100 stock',
          CURRENT_DATE + INTERVAL '21 days',
          ARRAY[pl_hvac]);
END IF;

END $$;
