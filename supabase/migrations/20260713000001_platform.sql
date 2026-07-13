-- =============================================================
-- Platform instrumentation + real specials/notifications + RFQ
--
--   events         append-only activity log (the chokepoint every
--                  later feature projects from: analytics, rewards,
--                  freshness notifications)
--   specials       real promotions (replaces lib/hub/specials.ts mocks)
--   notifications  per-user inbox, fanned out by triggers
--   rfqs/rfq_items structured quote requests from the Hub
--
-- Writes to events/notifications go through SECURITY DEFINER
-- functions or triggers only — no client INSERT policies.
-- =============================================================

-- ── organizations: let manufacturers see orgs they granted ───
-- Analytics and the RFQ queue must show distributor names; the
-- existing policies only exposed the caller's own org and granted
-- manufacturers.
CREATE POLICY "mfr sees granted distributors" ON organizations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM access_grants
    WHERE grantee_org_id = organizations.id
      AND manufacturer_org_id = current_org_id()
  )
);

-- =============================================================
-- TABLE: events
-- =============================================================

CREATE TABLE events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id        uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  actor_org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manufacturer_org_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type           text        NOT NULL CHECK (event_type IN
    ('file_preview', 'file_download', 'hub_view', 'search', 'rfq_submitted')),
  subject_id           uuid,
  metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX events_mfr_created_idx   ON events(manufacturer_org_id, created_at DESC);
CREATE INDEX events_actor_created_idx ON events(actor_user_id, created_at DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfr reads own events" ON events FOR SELECT USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "actor reads own events" ON events FOR SELECT USING (
  actor_user_id = auth.uid()
);
-- No INSERT policy: writes only via log_event().

CREATE OR REPLACE FUNCTION log_event(
  p_manufacturer_org_id uuid,
  p_event_type          text,
  p_subject_id          uuid DEFAULT NULL,
  p_metadata            jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  v_org := current_org_id();
  IF v_org IS NULL THEN RETURN; END IF;
  -- Don't log a manufacturer browsing their own catalog.
  IF v_org = p_manufacturer_org_id THEN RETURN; END IF;

  INSERT INTO events (actor_user_id, actor_org_id, manufacturer_org_id,
                      event_type, subject_id, metadata)
  VALUES (auth.uid(), v_org, p_manufacturer_org_id,
          p_event_type, p_subject_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

-- =============================================================
-- TABLE: specials
-- =============================================================

CREATE TABLE specials (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_org_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label                text        NOT NULL DEFAULT 'SPECIAL',
  headline             text        NOT NULL,
  terms_url            text,
  starts_on            date        NOT NULL DEFAULT CURRENT_DATE,
  ends_on              date        NOT NULL,
  eligible_line_ids    uuid[]      NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX specials_mfr_idx ON specials(manufacturer_org_id, ends_on);

CREATE TRIGGER specials_updated_at
  BEFORE UPDATE ON specials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE specials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfr manages own specials" ON specials FOR ALL USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "distributors read live specials" ON specials FOR SELECT USING (
  starts_on <= CURRENT_DATE
  AND ends_on >= CURRENT_DATE
  AND has_manufacturer_access(manufacturer_org_id)
);

-- =============================================================
-- TABLE: notifications
-- =============================================================

CREATE TABLE notifications (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manufacturer_org_id  uuid                 REFERENCES organizations(id) ON DELETE CASCADE,
  kind                 text        NOT NULL CHECK (kind IN
    ('special', 'file_updated', 'rfq_status', 'info')),
  title                text        NOT NULL,
  body                 text,
  special_id           uuid                 REFERENCES specials(id) ON DELETE CASCADE,
  read_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_recipient_idx
  ON notifications(recipient_user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient reads own notifications" ON notifications FOR SELECT USING (
  recipient_user_id = auth.uid()
);
CREATE POLICY "recipient marks read" ON notifications FOR UPDATE USING (
  recipient_user_id = auth.uid()
);
-- No INSERT policy: rows are created by the fan-out triggers below.

-- Everyone (org- or user-level) holding an active grant to a manufacturer.
CREATE OR REPLACE FUNCTION granted_user_ids(p_manufacturer_org_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT p.id
  FROM access_grants g
  JOIN profiles p
    ON (g.grantee_user_id IS NULL AND p.org_id = g.grantee_org_id)
    OR p.id = g.grantee_user_id
  WHERE g.manufacturer_org_id = p_manufacturer_org_id
    AND g.revoked_at IS NULL
$$;

-- Fan-out: new special → notify every granted user.
CREATE OR REPLACE FUNCTION notify_special()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (recipient_user_id, manufacturer_org_id, kind, title, body, special_id)
  SELECT uid, NEW.manufacturer_org_id, 'special',
         NEW.headline,
         'Ends ' || to_char(NEW.ends_on, 'Mon DD') || '. See the Hub for eligible lines.',
         NEW.id
  FROM granted_user_ids(NEW.manufacturer_org_id) AS uid;
  RETURN NEW;
END;
$$;

CREATE TRIGGER specials_notify
  AFTER INSERT ON specials
  FOR EACH ROW EXECUTE FUNCTION notify_special();

-- Fan-out: new price book → notify every granted user. INSERT only, so
-- metadata edits don't spam; re-uploads that bump updated_at are covered by
-- the upload script writing a fresh row when a file is genuinely new.
CREATE OR REPLACE FUNCTION notify_pricebook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.file_type = 'pricebook' THEN
    INSERT INTO notifications (recipient_user_id, manufacturer_org_id, kind, title, body)
    SELECT uid, NEW.owner_org_id, 'file_updated',
           'New price book: ' || NEW.filename,
           'A price book was published. Open the Price Sheets tab to review it.'
    FROM granted_user_ids(NEW.owner_org_id) AS uid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_notify_pricebook
  AFTER INSERT ON files
  FOR EACH ROW EXECUTE FUNCTION notify_pricebook();

-- =============================================================
-- TABLES: rfqs / rfq_items
-- Items reference product lines (the Hub's browsing unit).
-- =============================================================

CREATE TABLE rfqs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_org_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manufacturer_org_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by           uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  status               text        NOT NULL DEFAULT 'open' CHECK (status IN
    ('open', 'quoted', 'won', 'lost', 'cancelled')),
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX rfqs_mfr_idx  ON rfqs(manufacturer_org_id, created_at DESC);
CREATE INDEX rfqs_dist_idx ON rfqs(distributor_org_id, created_at DESC);

CREATE TRIGGER rfqs_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;

CREATE TABLE rfq_items (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id           uuid    NOT NULL REFERENCES rfqs(id)          ON DELETE CASCADE,
  product_line_id  uuid    NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note             text
);

CREATE INDEX rfq_items_rfq_idx ON rfq_items(rfq_id);

ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;

-- Distributor org members manage their own RFQs (must hold a grant to the
-- manufacturer they're asking); manufacturers see theirs and update status.
CREATE POLICY "distributor manages own rfqs" ON rfqs FOR ALL USING (
  distributor_org_id = current_org_id()
) WITH CHECK (
  distributor_org_id = current_org_id()
  AND has_manufacturer_access(manufacturer_org_id)
);
CREATE POLICY "mfr reads own rfqs" ON rfqs FOR SELECT USING (
  manufacturer_org_id = current_org_id()
);
CREATE POLICY "mfr updates rfq status" ON rfqs FOR UPDATE USING (
  manufacturer_org_id = current_org_id()
);

CREATE POLICY "rfq items follow rfq" ON rfq_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM rfqs r
    WHERE r.id = rfq_id
      AND (r.distributor_org_id = current_org_id()
           OR r.manufacturer_org_id = current_org_id())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM rfqs r
    WHERE r.id = rfq_id AND r.distributor_org_id = current_org_id()
  )
);

-- Fan-out: new RFQ → notify manufacturer admins; status change → notify the rep.
CREATE OR REPLACE FUNCTION notify_rfq()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (recipient_user_id, manufacturer_org_id, kind, title, body)
    SELECT p.id, NEW.manufacturer_org_id, 'rfq_status',
           'New quote request',
           'A distributor submitted an RFQ. Review it in your RFQ queue.'
    FROM profiles p
    WHERE p.org_id = NEW.manufacturer_org_id AND p.role = 'admin';

    PERFORM log_event(NEW.manufacturer_org_id, 'rfq_submitted', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO notifications (recipient_user_id, manufacturer_org_id, kind, title, body)
    VALUES (NEW.created_by, NEW.manufacturer_org_id, 'rfq_status',
            'Quote request ' || NEW.status,
            'Your RFQ status changed to "' || NEW.status || '".');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rfqs_notify
  AFTER INSERT OR UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION notify_rfq();
