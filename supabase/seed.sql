-- =============================================================
-- Tome — seed data (local development only)
-- Inserts: 2 manufacturer orgs, 2 distributor orgs,
--          4 auth users + profiles (1 admin per org),
--          3 product lines per manufacturer (6 total),
--          5 products per line (30 total),
--          6 sample file rows, 3 access_grants, 4 tags.
-- All passwords: "password123"
-- =============================================================

DO $$
DECLARE
  -- ── Organizations ──────────────────────────────────────────
  org_acme   uuid := '10000000-0000-0000-0000-000000000001';
  org_bolt   uuid := '10000000-0000-0000-0000-000000000002';
  org_supply uuid := '10000000-0000-0000-0000-000000000003';
  org_parts  uuid := '10000000-0000-0000-0000-000000000004';

  -- ── Auth / Profiles ────────────────────────────────────────
  user_alice  uuid := '20000000-0000-0000-0000-000000000001'; -- admin @ Acme
  user_bob    uuid := '20000000-0000-0000-0000-000000000002'; -- admin @ Bolt
  user_carol  uuid := '20000000-0000-0000-0000-000000000003'; -- admin @ Supply Direct
  user_dave   uuid := '20000000-0000-0000-0000-000000000004'; -- admin @ Parts Planet

  -- ── Product Lines (Acme) ───────────────────────────────────
  pl_hvac     uuid := '30000000-0000-0000-0000-000000000001';
  pl_elec     uuid := '30000000-0000-0000-0000-000000000002';
  pl_safety   uuid := '30000000-0000-0000-0000-000000000003';

  -- ── Product Lines (Bolt) ───────────────────────────────────
  pl_power    uuid := '30000000-0000-0000-0000-000000000004';
  pl_hand     uuid := '30000000-0000-0000-0000-000000000005';
  pl_fast     uuid := '30000000-0000-0000-0000-000000000006';

  -- ── Products (Acme / HVAC Controls — 5) ───────────────────
  p_hvac_1 uuid := '40000000-0000-0000-0001-000000000001';
  p_hvac_2 uuid := '40000000-0000-0000-0001-000000000002';
  p_hvac_3 uuid := '40000000-0000-0000-0001-000000000003';
  p_hvac_4 uuid := '40000000-0000-0000-0001-000000000004';
  p_hvac_5 uuid := '40000000-0000-0000-0001-000000000005';

  -- ── Products (Acme / Electrical — 5) ──────────────────────
  p_elec_1 uuid := '40000000-0000-0000-0002-000000000001';
  p_elec_2 uuid := '40000000-0000-0000-0002-000000000002';
  p_elec_3 uuid := '40000000-0000-0000-0002-000000000003';
  p_elec_4 uuid := '40000000-0000-0000-0002-000000000004';
  p_elec_5 uuid := '40000000-0000-0000-0002-000000000005';

  -- ── Products (Acme / Safety — 5) ──────────────────────────
  p_safe_1 uuid := '40000000-0000-0000-0003-000000000001';
  p_safe_2 uuid := '40000000-0000-0000-0003-000000000002';
  p_safe_3 uuid := '40000000-0000-0000-0003-000000000003';
  p_safe_4 uuid := '40000000-0000-0000-0003-000000000004';
  p_safe_5 uuid := '40000000-0000-0000-0003-000000000005';

  -- ── Products (Bolt / Power Tools — 5) ─────────────────────
  p_pow_1 uuid := '40000000-0000-0000-0004-000000000001';
  p_pow_2 uuid := '40000000-0000-0000-0004-000000000002';
  p_pow_3 uuid := '40000000-0000-0000-0004-000000000003';
  p_pow_4 uuid := '40000000-0000-0000-0004-000000000004';
  p_pow_5 uuid := '40000000-0000-0000-0004-000000000005';

  -- ── Products (Bolt / Hand Tools — 5) ──────────────────────
  p_hand_1 uuid := '40000000-0000-0000-0005-000000000001';
  p_hand_2 uuid := '40000000-0000-0000-0005-000000000002';
  p_hand_3 uuid := '40000000-0000-0000-0005-000000000003';
  p_hand_4 uuid := '40000000-0000-0000-0005-000000000004';
  p_hand_5 uuid := '40000000-0000-0000-0005-000000000005';

  -- ── Products (Bolt / Fasteners — 5) ───────────────────────
  p_fast_1 uuid := '40000000-0000-0000-0006-000000000001';
  p_fast_2 uuid := '40000000-0000-0000-0006-000000000002';
  p_fast_3 uuid := '40000000-0000-0000-0006-000000000003';
  p_fast_4 uuid := '40000000-0000-0000-0006-000000000004';
  p_fast_5 uuid := '40000000-0000-0000-0006-000000000005';

  -- ── Tags ───────────────────────────────────────────────────
  tag_commercial  uuid := '50000000-0000-0000-0000-000000000001';
  tag_industrial  uuid := '50000000-0000-0000-0000-000000000002';
  tag_residential uuid := '50000000-0000-0000-0000-000000000003';
  tag_certified   uuid := '50000000-0000-0000-0000-000000000004';

BEGIN

-- =============================================================
-- AUTH USERS  (local dev — password "password123")
-- =============================================================
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (user_alice, 'authenticated', 'authenticated',
   'alice@acme-mfg.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_bob, 'authenticated', 'authenticated',
   'bob@bolt-industries.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_carol, 'authenticated', 'authenticated',
   'carol@supplychaindirect.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
  (user_dave, 'authenticated', 'authenticated',
   'dave@partsplanet.com',
   crypt('password123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- ORGANIZATIONS
-- =============================================================
INSERT INTO organizations (id, name, slug, type) VALUES
  (org_acme,   'Acme Manufacturing',    'acme-manufacturing',   'manufacturer'),
  (org_bolt,   'Bolt Industries',       'bolt-industries',      'manufacturer'),
  (org_supply, 'SupplyChain Direct',    'supplychaindirect',    'distributor'),
  (org_parts,  'Parts Planet',          'parts-planet',         'distributor')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- PROFILES  (org_id = renamed from organization_id)
-- =============================================================
INSERT INTO profiles (id, org_id, full_name, role) VALUES
  (user_alice, org_acme,   'Alice Chen',      'admin'),
  (user_bob,   org_bolt,   'Bob Ramirez',     'admin'),
  (user_carol, org_supply, 'Carol Okafor',    'admin'),
  (user_dave,  org_parts,  'Dave Lindqvist',  'admin')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- MANUFACTURER PROFILES  (org_id = renamed from organization_id)
-- =============================================================
INSERT INTO manufacturer_profiles (org_id, tagline, about, contact_email) VALUES
  (org_acme,
   'Precision controls for every climate.',
   'Acme Manufacturing has delivered HVAC, electrical, and safety products since 1978. '
   'Our components are spec''d into more than 40,000 commercial buildings worldwide.',
   'info@acme-mfg.com'),
  (org_bolt,
   'Tools built to outlast the job.',
   'Bolt Industries designs and manufactures professional-grade power tools, hand tools, '
   'and fastening systems trusted by tradespeople on six continents.',
   'info@bolt-industries.com')
ON CONFLICT (org_id) DO NOTHING;

-- =============================================================
-- PRODUCT LINES  (manufacturer_org_id = renamed from organization_id)
-- =============================================================
INSERT INTO product_lines (id, manufacturer_org_id, name, description) VALUES
  -- Acme
  (pl_hvac,   org_acme, 'HVAC Controls',
   'Thermostats, damper actuators, and building automation controllers for commercial HVAC systems.'),
  (pl_elec,   org_acme, 'Electrical Components',
   'Breakers, panelboards, disconnect switches, and wiring devices for commercial and industrial installations.'),
  (pl_safety, org_acme, 'Safety Equipment',
   'Emergency lighting, exit signs, smoke detectors, and fire-rated enclosures.'),
  -- Bolt
  (pl_power,  org_bolt, 'Power Tools',
   'Cordless and corded drills, saws, grinders, and impact drivers for professional tradespeople.'),
  (pl_hand,   org_bolt, 'Hand Tools',
   'Wrenches, pliers, screwdrivers, and layout tools precision-manufactured for daily job-site use.'),
  (pl_fast,   org_bolt, 'Fasteners',
   'Structural screws, anchors, bolts, and specialty fasteners for wood, masonry, and steel applications.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- PRODUCTS  (manufacturer_org_id = renamed from organization_id)
-- tsvector populated automatically by trigger
-- =============================================================

-- ── Acme / HVAC Controls ─────────────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_hvac_1, pl_hvac, org_acme, 'AC-T100', 'Commercial Thermostat T100',
   'Programmable 7-day thermostat for single-stage heating and cooling systems.',
   'Thermostats',
   '{"voltage":"24V","stages":"1H/1C","display":"LCD","wireless":false}'),
  (p_hvac_2, pl_hvac, org_acme, 'AC-T200', 'Smart Thermostat T200',
   'Wi-Fi enabled smart thermostat with occupancy sensing and BACnet integration.',
   'Thermostats',
   '{"voltage":"24V","stages":"2H/2C","display":"Color touch","wireless":true,"protocol":"BACnet"}'),
  (p_hvac_3, pl_hvac, org_acme, 'AC-DA55', 'Damper Actuator DA55',
   'Spring-return modulating actuator for VAV boxes and zone dampers up to 55 in².',
   'Actuators',
   '{"torque":"35 lb-in","angle":"95°","control":"0-10V","power":"24VAC"}'),
  (p_hvac_4, pl_hvac, org_acme, 'AC-BA7', 'Building Automation Controller BA7',
   'Standalone DDC controller with 7 universal I/O points, BACnet MS/TP and IP.',
   'Controllers',
   '{"io_points":7,"protocol":"BACnet MS/TP + IP","memory":"512KB","enclosure":"NEMA 1"}'),
  (p_hvac_5, pl_hvac, org_acme, 'AC-CO2-W', 'CO₂ Wall Sensor',
   'Duct or wall-mount NDIR CO₂ sensor with 4-20 mA and 0-10 V outputs.',
   'Sensors',
   '{"range":"0-2000 ppm","output":"4-20mA / 0-10V","accuracy":"±30 ppm","mounting":"wall or duct"}')
ON CONFLICT (id) DO NOTHING;

-- ── Acme / Electrical Components ─────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_elec_1, pl_elec, org_acme, 'AC-CB20', '20A Single-Pole Breaker',
   'Thermal-magnetic circuit breaker, 20A 120/240VAC, plug-on neutral compatible.',
   'Breakers',
   '{"amperage":"20A","poles":1,"voltage":"120/240VAC","interrupt":"10kAIC"}'),
  (p_elec_2, pl_elec, org_acme, 'AC-CB200-3', '200A 3-Pole Main Breaker',
   'Molded-case main circuit breaker for 3-phase panelboards, 200A 480VAC.',
   'Breakers',
   '{"amperage":"200A","poles":3,"voltage":"480VAC","interrupt":"65kAIC"}'),
  (p_elec_3, pl_elec, org_acme, 'AC-PB42', '42-Circuit Panelboard',
   'Surface or flush-mount 42-circuit 200A main panelboard with solid neutral.',
   'Panelboards',
   '{"circuits":42,"main_amps":"200A","voltage":"120/240VAC","mounting":"surface/flush"}'),
  (p_elec_4, pl_elec, org_acme, 'AC-DS60', '60A Non-Fused Disconnect',
   'NEMA 3R 60A general-duty non-fused safety switch for exterior installations.',
   'Disconnects',
   '{"amperage":"60A","fused":false,"enclosure":"NEMA 3R","voltage":"240VAC"}'),
  (p_elec_5, pl_elec, org_acme, 'AC-TR15', 'Tamper-Resistant 15A Duplex Outlet',
   'Commercial-grade tamper-resistant duplex receptacle, 15A 125V, back- and side-wired.',
   'Wiring Devices',
   '{"amperage":"15A","voltage":"125V","tamper_resistant":true,"color":"white"}')
ON CONFLICT (id) DO NOTHING;

-- ── Acme / Safety Equipment ──────────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_safe_1, pl_safety, org_acme, 'AC-EL90', '90-Min Emergency Light',
   'Self-testing dual-head LED emergency light, 90-minute backup, wet-location listed.',
   'Emergency Lighting',
   '{"backup":"90 min","heads":2,"lamp":"LED","self_test":true,"listing":"UL 924"}'),
  (p_safe_2, pl_safety, org_acme, 'AC-EX-LED', 'LED Exit Sign',
   'Universal-mount LED exit sign, red letters, AC/DC operation with battery backup.',
   'Exit Signs',
   '{"color":"red","mounting":"universal","power":"AC/DC","backup":"90 min"}'),
  (p_safe_3, pl_safety, org_acme, 'AC-SD4', 'Photoelectric Smoke Detector',
   '4-wire photoelectric smoke detector with alarm LED and remote test capability.',
   'Detectors',
   '{"technology":"photoelectric","wiring":"4-wire","test":"remote","listing":"UL 217"}'),
  (p_safe_4, pl_safety, org_acme, 'AC-FR-ENC', 'Fire-Rated Enclosure 1HR',
   'Steel 1-hour fire-rated enclosure for electrical panels in fire-rated assemblies.',
   'Enclosures',
   '{"rating":"1 hour","material":"steel","size":"20x16x6 in","finish":"gray paint"}'),
  (p_safe_5, pl_safety, org_acme, 'AC-CO-A', 'Commercial CO Alarm',
   'Surface-mount carbon monoxide alarm, 120VAC with 9V battery backup and relay output.',
   'Detectors',
   '{"power":"120VAC + 9V backup","relay":true,"listing":"UL 2034","alarm_level":"70 ppm / 4 hr"}')
ON CONFLICT (id) DO NOTHING;

-- ── Bolt / Power Tools ────────────────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_pow_1, pl_power, org_bolt, 'BT-DRL20', '20V Cordless Drill/Driver',
   'Brushless 20V MAX cordless drill with 2-speed gearbox, LED light, and belt clip.',
   'Drills',
   '{"voltage":"20V","max_torque":"530 in-lb","speeds":2,"chuck":"1/2 in","brushless":true}'),
  (p_pow_2, pl_power, org_bolt, 'BT-CCS7', '7-1/4" Circular Saw',
   'Corded 15A circular saw with electric brake, laser guide, and bevel to 56°.',
   'Saws',
   '{"blade":"7-1/4 in","amps":"15A","bevel":"56°","no_load_rpm":5800,"brake":"electric"}'),
  (p_pow_3, pl_power, org_bolt, 'BT-AGR5', '5" Angle Grinder',
   'Corded 11A angle grinder with tool-free guard adjustment and anti-vibration side handle.',
   'Grinders',
   '{"disc":"5 in","amps":"11A","no_load_rpm":"11,000","guard":"tool-free"}'),
  (p_pow_4, pl_power, org_bolt, 'BT-IMP20', '20V Impact Driver',
   'Brushless 20V impact driver, 1,825 in-lb max torque, 3-speed selector with belt hook.',
   'Impact Drivers',
   '{"voltage":"20V","max_torque":"1825 in-lb","speeds":3,"chuck":"1/4 in hex","brushless":true}'),
  (p_pow_5, pl_power, org_bolt, 'BT-RECIP', '12A Reciprocating Saw',
   'Corded 12A reciprocating saw with tool-free blade change and orbital action.',
   'Saws',
   '{"amps":"12A","stroke":"1-1/8 in","spm":"0-3000","orbital":true,"blade_change":"tool-free"}')
ON CONFLICT (id) DO NOTHING;

-- ── Bolt / Hand Tools ─────────────────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_hand_1, pl_hand, org_bolt, 'BT-WR12', '12" Adjustable Wrench',
   'Drop-forged chrome-vanadium adjustable wrench with laser-etched scale.',
   'Wrenches',
   '{"length":"12 in","jaw_capacity":"1-5/16 in","material":"Cr-V steel","finish":"chrome"}'),
  (p_hand_2, pl_hand, org_bolt, 'BT-PL9', '9" Lineman''s Pliers',
   'Induction-hardened cutting edge lineman''s pliers with ergonomic dual-material grips.',
   'Pliers',
   '{"length":"9 in","material":"Cr-V steel","grip":"dual-material","hardened_edge":true}'),
  (p_hand_3, pl_hand, org_bolt, 'BT-SD6PH', '#2 Phillips 6" Screwdriver',
   'Precision-machined #2 Phillips screwdriver with tri-lobe handle and tip-ident band.',
   'Screwdrivers',
   '{"tip":"#2 Phillips","blade_length":"6 in","handle":"tri-lobe","material":"S2 steel"}'),
  (p_hand_4, pl_hand, org_bolt, 'BT-TP25', '25ft Tape Measure',
   'Standout 25ft tape measure with magnetic hook, Nylon-bond blade, and belt clip.',
   'Layout Tools',
   '{"length":"25 ft / 7.5 m","width":"1-1/4 in","standout":"11 ft","hook":"magnetic"}'),
  (p_hand_5, pl_hand, org_bolt, 'BT-HMR16', '16 oz Framing Hammer',
   'Milled-face 16 oz rip-claw framing hammer with fiberglass handle and overstrike guard.',
   'Hammers',
   '{"weight":"16 oz","face":"milled","claw":"rip","handle":"fiberglass"}')
ON CONFLICT (id) DO NOTHING;

-- ── Bolt / Fasteners ──────────────────────────────────────────
INSERT INTO products (id, product_line_id, manufacturer_org_id, model_number, name, description, category, specs) VALUES
  (p_fast_1, pl_fast, org_bolt, 'BT-SCR-3X', '#10 x 3" Structural Screws (100 pk)',
   'Star-drive coarse-thread structural screws, case-hardened, ACQ-rated coating, 100-pack.',
   'Screws',
   '{"size":"#10 x 3 in","drive":"T25 star","coating":"ACQ-rated","qty":100,"shear":"290 lb"}'),
  (p_fast_2, pl_fast, org_bolt, 'BT-SDS-38', '3/8" Concrete Wedge Anchor (25 pk)',
   'Torque-controlled wedge anchor for concrete, 3/8" x 3", carbon steel zinc-plated, 25-pack.',
   'Anchors',
   '{"diameter":"3/8 in","length":"3 in","material":"carbon steel","coating":"zinc","qty":25}'),
  (p_fast_3, pl_fast, org_bolt, 'BT-BLT-12', '1/2"-13 Hex Bolts Grade 5 (50 pk)',
   'Grade 5 zinc-plated hex cap screws, 1/2"-13 x 1-1/2", meets ASTM A449, 50-pack.',
   'Bolts',
   '{"size":"1/2-13 x 1-1/2 in","grade":"Grade 5","coating":"zinc","standard":"ASTM A449","qty":50}'),
  (p_fast_4, pl_fast, org_bolt, 'BT-NUT-12', '1/2"-13 Hex Nuts Grade 5 (100 pk)',
   'Grade 5 zinc-plated hex nuts, 1/2"-13, meets ASTM A563, 100-pack.',
   'Nuts',
   '{"size":"1/2-13","grade":"Grade 5","coating":"zinc","standard":"ASTM A563","qty":100}'),
  (p_fast_5, pl_fast, org_bolt, 'BT-TAPCON-14', '1/4" Tapcon Masonry Screw (75 pk)',
   'Blue Climaseal® 1/4" x 2-3/4" masonry screws for concrete, block, and brick, 75-pack.',
   'Anchors',
   '{"diameter":"1/4 in","length":"2-3/4 in","coating":"Climaseal blue","qty":75,"material":"carbon steel"}')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- TAGS
-- =============================================================
INSERT INTO tags (id, name) VALUES
  (tag_commercial, 'commercial'),
  (tag_industrial, 'industrial'),
  (tag_residential,'residential'),
  (tag_certified,  'ul-listed')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- PRODUCT TAGS
-- =============================================================
INSERT INTO product_tags (product_id, tag_id) VALUES
  (p_hvac_1, tag_commercial),
  (p_hvac_2, tag_commercial),
  (p_hvac_2, tag_certified),
  (p_hvac_3, tag_commercial),
  (p_elec_1, tag_residential),
  (p_elec_1, tag_commercial),
  (p_elec_3, tag_commercial),
  (p_safe_1, tag_commercial),
  (p_safe_1, tag_certified),
  (p_safe_3, tag_certified),
  (p_pow_1,  tag_industrial),
  (p_pow_1,  tag_commercial),
  (p_fast_1, tag_industrial),
  (p_fast_2, tag_industrial),
  (p_fast_2, tag_certified)
ON CONFLICT DO NOTHING;

-- =============================================================
-- FILES  (rows only; owner_org_id + product_line_id added)
-- storage objects not actually uploaded
-- =============================================================
INSERT INTO files (id, product_id, owner_org_id, product_line_id, filename, storage_path, file_type, file_size) VALUES
  ('60000000-0000-0000-0000-000000000001',
   p_hvac_2, org_acme, pl_hvac,
   'AC-T200_Installation_Guide.pdf',
   'acme-manufacturing/hvac-controls/AC-T200_Installation_Guide.pdf',
   'application/pdf', 2457600),

  ('60000000-0000-0000-0000-000000000002',
   p_hvac_2, org_acme, pl_hvac,
   'AC-T200_BACnet_Integration.pdf',
   'acme-manufacturing/hvac-controls/AC-T200_BACnet_Integration.pdf',
   'application/pdf', 1048576),

  ('60000000-0000-0000-0000-000000000003',
   p_hvac_4, org_acme, pl_hvac,
   'AC-BA7_Programming_Reference.pdf',
   'acme-manufacturing/hvac-controls/AC-BA7_Programming_Reference.pdf',
   'application/pdf', 5242880),

  ('60000000-0000-0000-0000-000000000004',
   p_elec_3, org_acme, pl_elec,
   'AC-PB42_Wiring_Diagram.pdf',
   'acme-manufacturing/electrical/AC-PB42_Wiring_Diagram.pdf',
   'application/pdf', 819200),

  ('60000000-0000-0000-0000-000000000005',
   p_pow_1, org_bolt, pl_power,
   'BT-DRL20_Operators_Manual.pdf',
   'bolt-industries/power-tools/BT-DRL20_Operators_Manual.pdf',
   'application/pdf', 3145728),

  ('60000000-0000-0000-0000-000000000006',
   p_fast_2, org_bolt, pl_fast,
   'BT-SDS-38_Load_Tables.pdf',
   'bolt-industries/fasteners/BT-SDS-38_Load_Tables.pdf',
   'application/pdf', 614400)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- ACCESS GRANTS  (scope model: scope_type + scope_id)
-- Grant 1: SupplyChain Direct → Acme HVAC Controls (product_line scope)
-- Grant 2: SupplyChain Direct → all Bolt products   (all scope)
-- Grant 3: Parts Planet       → Bolt Fasteners      (product_line scope)
-- =============================================================
INSERT INTO access_grants
  (id, manufacturer_org_id, grantee_org_id, scope_type, scope_id, granted_by)
VALUES
  ('70000000-0000-0000-0000-000000000001',
   org_acme, org_supply, 'product_line', pl_hvac, user_alice),

  ('70000000-0000-0000-0000-000000000002',
   org_bolt, org_supply, 'all',          NULL,    user_bob),

  ('70000000-0000-0000-0000-000000000003',
   org_bolt, org_parts,  'product_line', pl_fast, user_bob)
ON CONFLICT DO NOTHING;

END $$;
