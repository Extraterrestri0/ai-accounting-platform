-- =====================================================================
-- 0005 Append-only, hash-chained audit trail (tenant-scoped).
-- The chain (seq, prev_hash, this_hash) is computed by a BEFORE INSERT
-- trigger (server-side) so the app cannot forge it. A per-tenant advisory
-- lock serializes appends into a linear chain. Updates/deletes are blocked.
-- =====================================================================
CREATE TABLE audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  company_id      uuid,
  seq             bigint NOT NULL,
  actor_type      text NOT NULL CHECK (actor_type IN ('user','ai','system')),
  actor_id        uuid,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid,
  reason          text,
  before_snapshot jsonb,
  after_snapshot  jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  prev_hash       text NOT NULL,
  this_hash       text NOT NULL,
  UNIQUE (tenant_id, seq)
);
CREATE INDEX idx_audit_tenant_seq ON audit_events (tenant_id, seq);
CREATE INDEX idx_audit_entity ON audit_events (tenant_id, entity_type, entity_id);

-- canonical serialization shared by the writer trigger and the verifier
CREATE OR REPLACE FUNCTION app.audit_payload(
  p_tenant uuid, p_company uuid, p_seq bigint, p_actor_type text, p_actor_id uuid,
  p_action text, p_entity_type text, p_entity_id uuid, p_reason text,
  p_before jsonb, p_after jsonb, p_occurred timestamptz
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws('|',
    p_tenant::text, coalesce(p_company::text,''), p_seq::text, p_actor_type,
    coalesce(p_actor_id::text,''), p_action, p_entity_type, coalesce(p_entity_id::text,''),
    coalesce(p_reason,''), coalesce(p_before::text,''), coalesce(p_after::text,''), p_occurred::text);
$$;

-- writer: assigns seq + prev_hash + this_hash; app must NOT supply them
CREATE OR REPLACE FUNCTION app.audit_chain_writer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev text; last_seq bigint; payload text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text));  -- serialize per tenant
  SELECT this_hash, seq INTO prev, last_seq
    FROM audit_events WHERE tenant_id = NEW.tenant_id ORDER BY seq DESC LIMIT 1;
  IF prev IS NULL THEN prev := repeat('0',64); last_seq := 0; END IF;
  NEW.seq := last_seq + 1;
  NEW.prev_hash := prev;
  payload := app.audit_payload(NEW.tenant_id, NEW.company_id, NEW.seq, NEW.actor_type,
              NEW.actor_id, NEW.action, NEW.entity_type, NEW.entity_id, NEW.reason,
              NEW.before_snapshot, NEW.after_snapshot, NEW.occurred_at);
  NEW.this_hash := encode(digest(prev || '|' || payload, 'sha256'), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER audit_events_chain BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION app.audit_chain_writer();

-- immutability: no update/delete/truncate
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION app.deny_mutation();

-- verifier: recompute the chain for a tenant; FALSE on any broken link/hash
CREATE OR REPLACE FUNCTION app.verify_audit_chain(p_tenant uuid) RETURNS boolean
  LANGUAGE plpgsql STABLE AS $$
DECLARE r record; expected_prev text := repeat('0',64); recomputed text; payload text;
BEGIN
  FOR r IN SELECT * FROM audit_events WHERE tenant_id = p_tenant ORDER BY seq LOOP
    IF r.prev_hash <> expected_prev THEN RETURN false; END IF;
    payload := app.audit_payload(r.tenant_id, r.company_id, r.seq, r.actor_type, r.actor_id,
                r.action, r.entity_type, r.entity_id, r.reason,
                r.before_snapshot, r.after_snapshot, r.occurred_at);
    recomputed := encode(digest(r.prev_hash || '|' || payload, 'sha256'), 'hex');
    IF recomputed <> r.this_hash THEN RETURN false; END IF;
    expected_prev := r.this_hash;
  END LOOP;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION app.verify_audit_chain(uuid) TO app_user;
GRANT SELECT, INSERT ON audit_events TO app_user;  -- NO update/delete

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE  ROW LEVEL SECURITY;
CREATE POLICY audit_events_isolation ON audit_events
  USING      (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
