DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
DROP TRIGGER IF EXISTS audit_events_chain ON audit_events;
DROP FUNCTION IF EXISTS app.verify_audit_chain(uuid);
DROP FUNCTION IF EXISTS app.audit_chain_writer();
DROP FUNCTION IF EXISTS app.audit_payload(uuid,uuid,bigint,text,uuid,text,text,uuid,text,jsonb,jsonb,timestamptz);
DROP TABLE IF EXISTS audit_events;
