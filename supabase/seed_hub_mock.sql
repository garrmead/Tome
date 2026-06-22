-- =============================================================
-- Tome — Hub mock data (run AFTER seed.sql)
-- Adds: corrected file_types on existing files, ~40 new files
--       across all product lines (datasheet/manual/cad/iom/
--       pricebook/brochure), manufacturer contacts, and enables
--       price books for both seeded manufacturers.
--
-- Storage objects are NOT uploaded — the rows let the Hub UI
-- show populated tabs. Clicking "Open" on a file will fail at
-- the signed-URL step (no actual blob), which is expected.
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

  -- Pick the first product in each line as the file-owner anchor.
  p_hvac_1   uuid := '40000000-0000-0000-0001-000000000001';
  p_hvac_2   uuid := '40000000-0000-0000-0001-000000000002';
  p_hvac_3   uuid := '40000000-0000-0000-0001-000000000003';
  p_hvac_4   uuid := '40000000-0000-0000-0001-000000000004';
  p_elec_1   uuid := '40000000-0000-0000-0002-000000000001';
  p_elec_2   uuid := '40000000-0000-0000-0002-000000000002';
  p_elec_3   uuid := '40000000-0000-0000-0002-000000000003';
  p_safe_1   uuid := '40000000-0000-0000-0003-000000000001';
  p_safe_2   uuid := '40000000-0000-0000-0003-000000000002';
  p_safe_3   uuid := '40000000-0000-0000-0003-000000000003';
  p_pow_1    uuid := '40000000-0000-0000-0004-000000000001';
  p_pow_2    uuid := '40000000-0000-0000-0004-000000000002';
  p_pow_4    uuid := '40000000-0000-0000-0004-000000000004';
  p_hand_1   uuid := '40000000-0000-0000-0005-000000000001';
  p_hand_2   uuid := '40000000-0000-0000-0005-000000000002';
  p_hand_4   uuid := '40000000-0000-0000-0005-000000000004';
  p_fast_1   uuid := '40000000-0000-0000-0006-000000000001';
  p_fast_2   uuid := '40000000-0000-0000-0006-000000000002';
  p_fast_3   uuid := '40000000-0000-0000-0006-000000000003';

BEGIN

-- =============================================================
-- 1. Fix existing seed-file file_types (were stored as MIME)
-- =============================================================
UPDATE files SET file_type = 'manual'
 WHERE id = '60000000-0000-0000-0000-000000000001';
UPDATE files SET file_type = 'datasheet'
 WHERE id = '60000000-0000-0000-0000-000000000002';
UPDATE files SET file_type = 'manual'
 WHERE id = '60000000-0000-0000-0000-000000000003';
UPDATE files SET file_type = 'cad'
 WHERE id = '60000000-0000-0000-0000-000000000004';
UPDATE files SET file_type = 'manual'
 WHERE id = '60000000-0000-0000-0000-000000000005';
UPDATE files SET file_type = 'datasheet'
 WHERE id = '60000000-0000-0000-0000-000000000006';

-- =============================================================
-- 2. Enable price books on both manufacturers
-- =============================================================
UPDATE manufacturer_profiles
   SET enable_price_books = true
 WHERE org_id IN (org_acme, org_bolt);

-- =============================================================
-- 3. Manufacturer contacts (jsonb on manufacturer_profiles)
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
-- 4. PRODUCT-LEVEL FILES — Acme (HVAC, Electrical, Safety)
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size) VALUES
  -- HVAC Controls
  ('61000000-0000-0000-0001-000000000001', p_hvac_1, org_acme, pl_hvac,
   'AC-T100_Datasheet.pdf',
   'acme-manufacturing/hvac/AC-T100_Datasheet.pdf', 'datasheet', 1240000),
  ('61000000-0000-0000-0001-000000000002', p_hvac_1, org_acme, pl_hvac,
   'AC-T100_Wiring_Diagram.pdf',
   'acme-manufacturing/hvac/AC-T100_Wiring.pdf', 'cad', 540000),
  ('61000000-0000-0000-0001-000000000003', p_hvac_2, org_acme, pl_hvac,
   'AC-T200_Datasheet.pdf',
   'acme-manufacturing/hvac/AC-T200_Datasheet.pdf', 'datasheet', 1800000),
  ('61000000-0000-0000-0001-000000000004', p_hvac_2, org_acme, pl_hvac,
   'AC-T200_Performance_Curves.pdf',
   'acme-manufacturing/hvac/AC-T200_Curves.pdf', 'datasheet', 2100000),
  ('61000000-0000-0000-0001-000000000005', p_hvac_3, org_acme, pl_hvac,
   'AC-DA55_IOM.pdf',
   'acme-manufacturing/hvac/AC-DA55_IOM.pdf', 'iom', 1500000),
  ('61000000-0000-0000-0001-000000000006', p_hvac_4, org_acme, pl_hvac,
   'AC-BA7_BACnet_Object_List.pdf',
   'acme-manufacturing/hvac/AC-BA7_BACnet.pdf', 'datasheet', 980000),
  ('61000000-0000-0000-0001-000000000007', p_hvac_4, org_acme, pl_hvac,
   'AC-BA7_Dimensional_Drawing.dwg',
   'acme-manufacturing/hvac/AC-BA7_Dim.dwg', 'cad', 720000),

  -- Electrical
  ('61000000-0000-0000-0002-000000000001', p_elec_1, org_acme, pl_elec,
   'AC-CB20_Datasheet.pdf',
   'acme-manufacturing/elec/AC-CB20_Datasheet.pdf', 'datasheet', 640000),
  ('61000000-0000-0000-0002-000000000002', p_elec_2, org_acme, pl_elec,
   'AC-CB200-3_Trip_Curves.pdf',
   'acme-manufacturing/elec/AC-CB200_Curves.pdf', 'datasheet', 1320000),
  ('61000000-0000-0000-0002-000000000003', p_elec_2, org_acme, pl_elec,
   'AC-CB200-3_Installation_Manual.pdf',
   'acme-manufacturing/elec/AC-CB200_Manual.pdf', 'manual', 2800000),
  ('61000000-0000-0000-0002-000000000004', p_elec_3, org_acme, pl_elec,
   'AC-PB42_Datasheet.pdf',
   'acme-manufacturing/elec/AC-PB42_Datasheet.pdf', 'datasheet', 1100000),
  ('61000000-0000-0000-0002-000000000005', p_elec_3, org_acme, pl_elec,
   'AC-PB42_Field_Wiring.dwg',
   'acme-manufacturing/elec/AC-PB42_Wiring.dwg', 'cad', 890000),

  -- Safety
  ('61000000-0000-0000-0003-000000000001', p_safe_1, org_acme, pl_safety,
   'AC-EL90_UL924_Cert.pdf',
   'acme-manufacturing/safety/AC-EL90_UL924.pdf', 'datasheet', 480000),
  ('61000000-0000-0000-0003-000000000002', p_safe_1, org_acme, pl_safety,
   'AC-EL90_IOM.pdf',
   'acme-manufacturing/safety/AC-EL90_IOM.pdf', 'iom', 1650000),
  ('61000000-0000-0000-0003-000000000003', p_safe_2, org_acme, pl_safety,
   'AC-EX-LED_Datasheet.pdf',
   'acme-manufacturing/safety/AC-EX-LED_Datasheet.pdf', 'datasheet', 720000),
  ('61000000-0000-0000-0003-000000000004', p_safe_3, org_acme, pl_safety,
   'AC-SD4_Installation_Guide.pdf',
   'acme-manufacturing/safety/AC-SD4_Install.pdf', 'manual', 1240000),
  ('61000000-0000-0000-0003-000000000005', p_safe_3, org_acme, pl_safety,
   'AC-SD4_Quickstart.pdf',
   'acme-manufacturing/safety/AC-SD4_Quickstart.pdf', 'brochure', 380000)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 5. PRODUCT-LEVEL FILES — Bolt (Power, Hand, Fasteners)
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size) VALUES
  -- Power Tools
  ('62000000-0000-0000-0004-000000000001', p_pow_1, org_bolt, pl_power,
   'BT-DRL20_Datasheet.pdf',
   'bolt-industries/power/BT-DRL20_Datasheet.pdf', 'datasheet', 980000),
  ('62000000-0000-0000-0004-000000000002', p_pow_1, org_bolt, pl_power,
   'BT-DRL20_Torque_Curves.pdf',
   'bolt-industries/power/BT-DRL20_Curves.pdf', 'datasheet', 540000),
  ('62000000-0000-0000-0004-000000000003', p_pow_2, org_bolt, pl_power,
   'BT-CCS7_Operators_Manual.pdf',
   'bolt-industries/power/BT-CCS7_Manual.pdf', 'manual', 2400000),
  ('62000000-0000-0000-0004-000000000004', p_pow_2, org_bolt, pl_power,
   'BT-CCS7_Blade_Guide.pdf',
   'bolt-industries/power/BT-CCS7_Blades.pdf', 'brochure', 620000),
  ('62000000-0000-0000-0004-000000000005', p_pow_4, org_bolt, pl_power,
   'BT-IMP20_Datasheet.pdf',
   'bolt-industries/power/BT-IMP20_Datasheet.pdf', 'datasheet', 720000),

  -- Hand Tools
  ('62000000-0000-0000-0005-000000000001', p_hand_1, org_bolt, pl_hand,
   'BT-WR12_Datasheet.pdf',
   'bolt-industries/hand/BT-WR12_Datasheet.pdf', 'datasheet', 320000),
  ('62000000-0000-0000-0005-000000000002', p_hand_2, org_bolt, pl_hand,
   'BT-PL9_Spec_Sheet.pdf',
   'bolt-industries/hand/BT-PL9_Spec.pdf', 'datasheet', 280000),
  ('62000000-0000-0000-0005-000000000003', p_hand_4, org_bolt, pl_hand,
   'BT-TP25_Datasheet.pdf',
   'bolt-industries/hand/BT-TP25_Datasheet.pdf', 'datasheet', 240000),

  -- Fasteners
  ('62000000-0000-0000-0006-000000000001', p_fast_1, org_bolt, pl_fast,
   'BT-SCR-3X_Datasheet.pdf',
   'bolt-industries/fast/BT-SCR-3X_Datasheet.pdf', 'datasheet', 410000),
  ('62000000-0000-0000-0006-000000000002', p_fast_1, org_bolt, pl_fast,
   'BT-SCR-3X_Shear_Tables.pdf',
   'bolt-industries/fast/BT-SCR-3X_Shear.pdf', 'datasheet', 580000),
  ('62000000-0000-0000-0006-000000000003', p_fast_2, org_bolt, pl_fast,
   'BT-SDS-38_Installation_Spec.pdf',
   'bolt-industries/fast/BT-SDS-38_Install.pdf', 'manual', 920000),
  ('62000000-0000-0000-0006-000000000004', p_fast_3, org_bolt, pl_fast,
   'BT-BLT-12_Materials_Cert.pdf',
   'bolt-industries/fast/BT-BLT-12_Cert.pdf', 'datasheet', 360000)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 6. LINE-LEVEL FILES — price books + cheat sheets
--    (product_id can be NULL; owner_org_id + product_line_id set)
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id,
                   filename, storage_path, file_type, file_size) VALUES
  -- Acme price books
  ('63000000-0000-0000-0001-000000000001', NULL, org_acme, pl_hvac,
   'Acme_HVAC_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/HVAC_2026Q2.pdf', 'pricebook', 4200000),
  ('63000000-0000-0000-0002-000000000001', NULL, org_acme, pl_elec,
   'Acme_Electrical_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/Elec_2026Q2.pdf', 'pricebook', 3800000),
  ('63000000-0000-0000-0003-000000000001', NULL, org_acme, pl_safety,
   'Acme_Safety_PriceBook_2026Q2.pdf',
   'acme-manufacturing/pricebooks/Safety_2026Q2.pdf', 'pricebook', 2900000),

  -- Bolt price books
  ('63000000-0000-0000-0004-000000000001', NULL, org_bolt, pl_power,
   'Bolt_PowerTools_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Power_2026Q2.pdf', 'pricebook', 5100000),
  ('63000000-0000-0000-0005-000000000001', NULL, org_bolt, pl_hand,
   'Bolt_HandTools_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Hand_2026Q2.pdf', 'pricebook', 3200000),
  ('63000000-0000-0000-0006-000000000001', NULL, org_bolt, pl_fast,
   'Bolt_Fasteners_PriceBook_2026Q2.pdf',
   'bolt-industries/pricebooks/Fast_2026Q2.pdf', 'pricebook', 2800000),

  -- Acme cheat sheets (brochure / other)
  ('64000000-0000-0000-0001-000000000001', NULL, org_acme, pl_hvac,
   'BACnet_Quick_Reference.pdf',
   'acme-manufacturing/cheats/BACnet_QuickRef.pdf', 'brochure', 480000),
  ('64000000-0000-0000-0002-000000000001', NULL, org_acme, pl_elec,
   'NEC_2023_Breaker_Sizing_Cheatsheet.pdf',
   'acme-manufacturing/cheats/NEC_Breakers.pdf', 'brochure', 620000),
  ('64000000-0000-0000-0003-000000000001', NULL, org_acme, pl_safety,
   'UL924_Compliance_Checklist.pdf',
   'acme-manufacturing/cheats/UL924_Checklist.pdf', 'brochure', 410000),

  -- Bolt cheat sheets
  ('64000000-0000-0000-0004-000000000001', NULL, org_bolt, pl_power,
   'Battery_Platform_Compatibility.pdf',
   'bolt-industries/cheats/Battery_Compat.pdf', 'brochure', 380000),
  ('64000000-0000-0000-0005-000000000001', NULL, org_bolt, pl_hand,
   'Torque_Conversion_Pocket_Guide.pdf',
   'bolt-industries/cheats/Torque_Guide.pdf', 'brochure', 290000),
  ('64000000-0000-0000-0006-000000000001', NULL, org_bolt, pl_fast,
   'Anchor_Selection_Quickstart.pdf',
   'bolt-industries/cheats/Anchor_Quickstart.pdf', 'brochure', 340000),
  ('64000000-0000-0000-0006-000000000002', NULL, org_bolt, pl_fast,
   'Concrete_Embedment_Chart.pdf',
   'bolt-industries/cheats/Concrete_Embed.pdf', 'other', 510000)
ON CONFLICT (id) DO NOTHING;

END $$;
