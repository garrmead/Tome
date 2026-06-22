-- =============================================================
-- Tome — Hub mock data
-- Run AFTER applying migrations. Designed to work whether or not
-- the original seed.sql has been run — it gracefully no-ops on
-- any manufacturer / product line that doesn't exist.
--
-- Adds:
--   • Manufacturer profiles (with contacts) for any seeded
--     manufacturer orgs that don't already have one.
--   • ~40 file rows attached at the product-line level
--     (product_id = NULL) so no FK to products is required.
--   • Price books per line and brochures (cheat sheets) per line.
--
-- Storage objects are NOT uploaded — file rows let the Hub UI
-- show populated tabs. Clicking "Open" will fail at the
-- signed-URL step (expected).
--
-- Idempotent: safe to re-run.
-- =============================================================

DO $$
DECLARE
  org_acme   uuid := '10000000-0000-0000-0000-000000000001';
  org_bolt   uuid := '10000000-0000-0000-0000-000000000002';

  pl_hvac    uuid := '30000000-0000-0000-0000-000000000001';
  pl_elec    uuid := '30000000-0000-0000-0000-000000000002';
  pl_safety  uuid := '30000000-0000-0000-0000-000000000003';
  pl_power   uuid := '30000000-0000-0000-0000-000000000004';
  pl_hand    uuid := '30000000-0000-0000-0000-000000000005';
  pl_fast    uuid := '30000000-0000-0000-0000-000000000006';

BEGIN

-- =============================================================
-- 1. Make sure manufacturer_profiles rows exist & enable price books
-- =============================================================
INSERT INTO manufacturer_profiles (org_id, tagline, about, contact_email, enable_price_books)
SELECT org_acme,
       'Precision controls for every climate.',
       'Acme Manufacturing has delivered HVAC, electrical, and safety products since 1978.',
       'info@acme-mfg.com',
       true
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = org_acme)
ON CONFLICT (org_id) DO UPDATE SET enable_price_books = true;

INSERT INTO manufacturer_profiles (org_id, tagline, about, contact_email, enable_price_books)
SELECT org_bolt,
       'Tools built to outlast the job.',
       'Bolt Industries designs and manufactures professional-grade tools.',
       'info@bolt-industries.com',
       true
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = org_bolt)
ON CONFLICT (org_id) DO UPDATE SET enable_price_books = true;

-- =============================================================
-- 2. Manufacturer contacts (jsonb)
-- =============================================================
UPDATE manufacturer_profiles
   SET contacts = '[
        {"id":"c-acme-1","name":"Marcus Hale","title":"Regional Sales Manager — SE",
         "email":"marcus.hale@acme-mfg.com","phone":"704-555-0142","region":"SE-US"},
        {"id":"c-acme-2","name":"Priya Sundaram","title":"Applications Engineer",
         "email":"priya.s@acme-mfg.com","phone":"704-555-0166","region":"All"},
        {"id":"c-acme-3","name":"Devon Park","title":"Inside Sales — HVAC",
         "email":"devon.park@acme-mfg.com","phone":"704-555-0190","region":"All"},
        {"id":"c-acme-4","name":"Erin Whitlock","title":"Quote Specialist",
         "email":"erin.whitlock@acme-mfg.com","phone":"704-555-0211","region":"SE-US"},
        {"id":"c-acme-5","name":"Tomas Ardill","title":"Technical Support Lead",
         "email":"tomas.ardill@acme-mfg.com","phone":"704-555-0233","region":"All"}
      ]'::jsonb
 WHERE org_id = org_acme;

UPDATE manufacturer_profiles
   SET contacts = '[
        {"id":"c-bolt-1","name":"Jenna Reyes","title":"District Manager — SE",
         "email":"jenna.reyes@bolt-industries.com","phone":"864-555-0118","region":"SE-US"},
        {"id":"c-bolt-2","name":"Aaron Kim","title":"Power Tools Product Lead",
         "email":"aaron.kim@bolt-industries.com","phone":"864-555-0140","region":"All"},
        {"id":"c-bolt-3","name":"Sasha Volkov","title":"Fasteners Specialist",
         "email":"sasha.volkov@bolt-industries.com","phone":"864-555-0172","region":"All"},
        {"id":"c-bolt-4","name":"Renee Beaumont","title":"Inside Sales",
         "email":"renee.b@bolt-industries.com","phone":"864-555-0199","region":"SE-US"}
      ]'::jsonb
 WHERE org_id = org_bolt;

-- =============================================================
-- 3. Fix any pre-existing files whose file_type is a MIME string
--    (from the original seed.sql, which set 'application/pdf').
-- =============================================================
UPDATE files
   SET file_type = 'datasheet'
 WHERE file_type = 'application/pdf';

-- =============================================================
-- 4. LINE-LEVEL FILES — no product_id, just product_line_id.
--    Works even if seed.sql products were never inserted.
--    Each INSERT is guarded by a WHERE EXISTS so missing lines
--    are skipped silently.
-- =============================================================

-- ---- Acme / HVAC Controls ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('61000000-0000-0000-0001-000000000001'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-T100_Datasheet.pdf',
   'acme-manufacturing/hvac/AC-T100_Datasheet.pdf', 'datasheet', 1240000),
  ('61000000-0000-0000-0001-000000000002'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-T100_Wiring_Diagram.pdf',
   'acme-manufacturing/hvac/AC-T100_Wiring.pdf', 'cad', 540000),
  ('61000000-0000-0000-0001-000000000003'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-T200_Datasheet.pdf',
   'acme-manufacturing/hvac/AC-T200_Datasheet.pdf', 'datasheet', 1800000),
  ('61000000-0000-0000-0001-000000000004'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-T200_Performance_Curves.pdf',
   'acme-manufacturing/hvac/AC-T200_Curves.pdf', 'datasheet', 2100000),
  ('61000000-0000-0000-0001-000000000005'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-DA55_IOM.pdf',
   'acme-manufacturing/hvac/AC-DA55_IOM.pdf', 'iom', 1500000),
  ('61000000-0000-0000-0001-000000000006'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-BA7_BACnet_Object_List.pdf',
   'acme-manufacturing/hvac/AC-BA7_BACnet.pdf', 'datasheet', 980000),
  ('61000000-0000-0000-0001-000000000007'::uuid, NULL::uuid, org_acme, pl_hvac,
   'AC-BA7_Dimensional_Drawing.dwg',
   'acme-manufacturing/hvac/AC-BA7_Dim.dwg', 'cad', 720000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_hvac)
ON CONFLICT (id) DO NOTHING;

-- ---- Acme / Electrical ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('61000000-0000-0000-0002-000000000001'::uuid, NULL::uuid, org_acme, pl_elec,
   'AC-CB20_Datasheet.pdf',
   'acme-manufacturing/elec/AC-CB20_Datasheet.pdf', 'datasheet', 640000),
  ('61000000-0000-0000-0002-000000000002'::uuid, NULL::uuid, org_acme, pl_elec,
   'AC-CB200-3_Trip_Curves.pdf',
   'acme-manufacturing/elec/AC-CB200_Curves.pdf', 'datasheet', 1320000),
  ('61000000-0000-0000-0002-000000000003'::uuid, NULL::uuid, org_acme, pl_elec,
   'AC-CB200-3_Installation_Manual.pdf',
   'acme-manufacturing/elec/AC-CB200_Manual.pdf', 'manual', 2800000),
  ('61000000-0000-0000-0002-000000000004'::uuid, NULL::uuid, org_acme, pl_elec,
   'AC-PB42_Datasheet.pdf',
   'acme-manufacturing/elec/AC-PB42_Datasheet.pdf', 'datasheet', 1100000),
  ('61000000-0000-0000-0002-000000000005'::uuid, NULL::uuid, org_acme, pl_elec,
   'AC-PB42_Field_Wiring.dwg',
   'acme-manufacturing/elec/AC-PB42_Wiring.dwg', 'cad', 890000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_elec)
ON CONFLICT (id) DO NOTHING;

-- ---- Acme / Safety ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('61000000-0000-0000-0003-000000000001'::uuid, NULL::uuid, org_acme, pl_safety,
   'AC-EL90_UL924_Cert.pdf',
   'acme-manufacturing/safety/AC-EL90_UL924.pdf', 'datasheet', 480000),
  ('61000000-0000-0000-0003-000000000002'::uuid, NULL::uuid, org_acme, pl_safety,
   'AC-EL90_IOM.pdf',
   'acme-manufacturing/safety/AC-EL90_IOM.pdf', 'iom', 1650000),
  ('61000000-0000-0000-0003-000000000003'::uuid, NULL::uuid, org_acme, pl_safety,
   'AC-EX-LED_Datasheet.pdf',
   'acme-manufacturing/safety/AC-EX-LED_Datasheet.pdf', 'datasheet', 720000),
  ('61000000-0000-0000-0003-000000000004'::uuid, NULL::uuid, org_acme, pl_safety,
   'AC-SD4_Installation_Guide.pdf',
   'acme-manufacturing/safety/AC-SD4_Install.pdf', 'manual', 1240000),
  ('61000000-0000-0000-0003-000000000005'::uuid, NULL::uuid, org_acme, pl_safety,
   'AC-SD4_Quickstart.pdf',
   'acme-manufacturing/safety/AC-SD4_Quickstart.pdf', 'brochure', 380000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_safety)
ON CONFLICT (id) DO NOTHING;

-- ---- Bolt / Power Tools ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('62000000-0000-0000-0004-000000000001'::uuid, NULL::uuid, org_bolt, pl_power,
   'BT-DRL20_Datasheet.pdf',
   'bolt-industries/power/BT-DRL20_Datasheet.pdf', 'datasheet', 980000),
  ('62000000-0000-0000-0004-000000000002'::uuid, NULL::uuid, org_bolt, pl_power,
   'BT-DRL20_Torque_Curves.pdf',
   'bolt-industries/power/BT-DRL20_Curves.pdf', 'datasheet', 540000),
  ('62000000-0000-0000-0004-000000000003'::uuid, NULL::uuid, org_bolt, pl_power,
   'BT-CCS7_Operators_Manual.pdf',
   'bolt-industries/power/BT-CCS7_Manual.pdf', 'manual', 2400000),
  ('62000000-0000-0000-0004-000000000004'::uuid, NULL::uuid, org_bolt, pl_power,
   'BT-CCS7_Blade_Guide.pdf',
   'bolt-industries/power/BT-CCS7_Blades.pdf', 'brochure', 620000),
  ('62000000-0000-0000-0004-000000000005'::uuid, NULL::uuid, org_bolt, pl_power,
   'BT-IMP20_Datasheet.pdf',
   'bolt-industries/power/BT-IMP20_Datasheet.pdf', 'datasheet', 720000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_power)
ON CONFLICT (id) DO NOTHING;

-- ---- Bolt / Hand Tools ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('62000000-0000-0000-0005-000000000001'::uuid, NULL::uuid, org_bolt, pl_hand,
   'BT-WR12_Datasheet.pdf',
   'bolt-industries/hand/BT-WR12_Datasheet.pdf', 'datasheet', 320000),
  ('62000000-0000-0000-0005-000000000002'::uuid, NULL::uuid, org_bolt, pl_hand,
   'BT-PL9_Spec_Sheet.pdf',
   'bolt-industries/hand/BT-PL9_Spec.pdf', 'datasheet', 280000),
  ('62000000-0000-0000-0005-000000000003'::uuid, NULL::uuid, org_bolt, pl_hand,
   'BT-TP25_Datasheet.pdf',
   'bolt-industries/hand/BT-TP25_Datasheet.pdf', 'datasheet', 240000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_hand)
ON CONFLICT (id) DO NOTHING;

-- ---- Bolt / Fasteners ----
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('62000000-0000-0000-0006-000000000001'::uuid, NULL::uuid, org_bolt, pl_fast,
   'BT-SCR-3X_Datasheet.pdf',
   'bolt-industries/fast/BT-SCR-3X_Datasheet.pdf', 'datasheet', 410000),
  ('62000000-0000-0000-0006-000000000002'::uuid, NULL::uuid, org_bolt, pl_fast,
   'BT-SCR-3X_Shear_Tables.pdf',
   'bolt-industries/fast/BT-SCR-3X_Shear.pdf', 'datasheet', 580000),
  ('62000000-0000-0000-0006-000000000003'::uuid, NULL::uuid, org_bolt, pl_fast,
   'BT-SDS-38_Installation_Spec.pdf',
   'bolt-industries/fast/BT-SDS-38_Install.pdf', 'manual', 920000),
  ('62000000-0000-0000-0006-000000000004'::uuid, NULL::uuid, org_bolt, pl_fast,
   'BT-BLT-12_Materials_Cert.pdf',
   'bolt-industries/fast/BT-BLT-12_Cert.pdf', 'datasheet', 360000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = pl_fast)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 5. PRICE BOOKS — one per line that exists
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('63000000-0000-0000-0001-000000000001'::uuid, NULL::uuid, org_acme,  pl_hvac,
   'Acme_HVAC_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/HVAC_2026Q2.pdf', 'pricebook', 4200000),
  ('63000000-0000-0000-0002-000000000001'::uuid, NULL::uuid, org_acme,  pl_elec,
   'Acme_Electrical_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/Elec_2026Q2.pdf', 'pricebook', 3800000),
  ('63000000-0000-0000-0003-000000000001'::uuid, NULL::uuid, org_acme,  pl_safety,
   'Acme_Safety_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/Safety_2026Q2.pdf', 'pricebook', 2900000),
  ('63000000-0000-0000-0004-000000000001'::uuid, NULL::uuid, org_bolt,  pl_power,
   'Bolt_PowerTools_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Power_2026Q2.pdf', 'pricebook', 5100000),
  ('63000000-0000-0000-0005-000000000001'::uuid, NULL::uuid, org_bolt,  pl_hand,
   'Bolt_HandTools_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Hand_2026Q2.pdf', 'pricebook', 3200000),
  ('63000000-0000-0000-0006-000000000001'::uuid, NULL::uuid, org_bolt,  pl_fast,
   'Bolt_Fasteners_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Fast_2026Q2.pdf', 'pricebook', 2800000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = v.product_line_id)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 6. CHEAT SHEETS (brochure / other)
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size)
SELECT * FROM (VALUES
  ('64000000-0000-0000-0001-000000000001'::uuid, NULL::uuid, org_acme, pl_hvac,
   'BACnet_Quick_Reference.pdf',
   'acme-manufacturing/cheats/BACnet_QuickRef.pdf', 'brochure', 480000),
  ('64000000-0000-0000-0002-000000000001'::uuid, NULL::uuid, org_acme, pl_elec,
   'NEC_2023_Breaker_Sizing_Cheatsheet.pdf',
   'acme-manufacturing/cheats/NEC_Breakers.pdf', 'brochure', 620000),
  ('64000000-0000-0000-0003-000000000001'::uuid, NULL::uuid, org_acme, pl_safety,
   'UL924_Compliance_Checklist.pdf',
   'acme-manufacturing/cheats/UL924_Checklist.pdf', 'brochure', 410000),
  ('64000000-0000-0000-0004-000000000001'::uuid, NULL::uuid, org_bolt, pl_power,
   'Battery_Platform_Compatibility.pdf',
   'bolt-industries/cheats/Battery_Compat.pdf', 'brochure', 380000),
  ('64000000-0000-0000-0005-000000000001'::uuid, NULL::uuid, org_bolt, pl_hand,
   'Torque_Conversion_Pocket_Guide.pdf',
   'bolt-industries/cheats/Torque_Guide.pdf', 'brochure', 290000),
  ('64000000-0000-0000-0006-000000000001'::uuid, NULL::uuid, org_bolt, pl_fast,
   'Anchor_Selection_Quickstart.pdf',
   'bolt-industries/cheats/Anchor_Quickstart.pdf', 'brochure', 340000),
  ('64000000-0000-0000-0006-000000000002'::uuid, NULL::uuid, org_bolt, pl_fast,
   'Concrete_Embedment_Chart.pdf',
   'bolt-industries/cheats/Concrete_Embed.pdf', 'other', 510000)
) AS v(id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size)
WHERE EXISTS (SELECT 1 FROM product_lines WHERE id = v.product_line_id)
ON CONFLICT (id) DO NOTHING;

END $$;
