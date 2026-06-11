-- =====================================================================
-- 0039 AI Accountant Phase 1 (ADR-001) — ai_answers: append-only record of every
-- assistant question + grounded answer. Tenant-scoped (RLS ENABLE+FORCE), immutable
-- (no UPDATE/DELETE path), and answered rows MUST carry citations (DB-enforced).
-- The assistant is read-only everywhere else: app_user gets SELECT+INSERT here ONLY.
-- =====================================================================

CREATE TABLE ai_answers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  question_kind      text NOT NULL CHECK (question_kind IN ('key','text')),  -- 'text' reserved for Phase 2
  question_key       text,                  -- playbook key (NULL when kind='text')
  question_text      text,                  -- NULL in Phase 1
  context            jsonb NOT NULL DEFAULT '{}',
  status             text NOT NULL CHECK (status IN ('answered','abstained','failed')),
  answer_md          text NOT NULL,
  citations          jsonb NOT NULL DEFAULT '[]',
  confidence         numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  tool_trace         jsonb NOT NULL DEFAULT '[]',
  llm_used           boolean NOT NULL DEFAULT false,
  model_version      text,
  prompt_version     text NOT NULL,
  rule_card_versions jsonb NOT NULL DEFAULT '{}',
  response_ms        integer,
  asked_by           uuid NOT NULL,         -- the human who asked
  generated_at       timestamptz NOT NULL DEFAULT now(),
  -- ADR-001 §3: no answered response without citations
  CONSTRAINT answered_needs_citations CHECK (status <> 'answered' OR jsonb_array_length(citations) >= 1),
  CONSTRAINT key_question_has_key CHECK (question_kind <> 'key' OR question_key IS NOT NULL)
);

CREATE INDEX ai_answers_company_time ON ai_answers (tenant_id, company_id, generated_at DESC);
CREATE INDEX ai_answers_question_key ON ai_answers (tenant_id, question_key);

-- Append-only: answers are a historical record (like extraction_fields).
CREATE TRIGGER ai_answers_immutable BEFORE UPDATE OR DELETE ON ai_answers
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT ON ai_answers TO app_user;  -- immutable, read+append only

DO $$
BEGIN
  EXECUTE 'ALTER TABLE ai_answers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE ai_answers FORCE  ROW LEVEL SECURITY';
  EXECUTE $f$
    CREATE POLICY ai_answers_isolation ON ai_answers
      USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
      WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
  $f$;
END $$;
