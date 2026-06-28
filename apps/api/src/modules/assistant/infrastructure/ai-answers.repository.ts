import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { AskContext, Citation, ToolTraceEntry } from '../domain/models';

export interface InsertAnswerInput {
  id: string;                       // pre-generated so audit events can reference it
  questionKind: 'key' | 'text';
  questionKey?: string;
  questionText?: string;
  context: AskContext;
  status: 'answered' | 'abstained' | 'failed';
  answerMd: string;
  citations: Citation[];
  confidence: number;
  toolTrace: ToolTraceEntry[];
  llmUsed: boolean;
  modelVersion: string;
  promptVersion: string;
  ruleCardVersions: Record<string, string>;
  responseMs: number;
  askedBy: string;
}

/** Append-only log of assistant answers (versions + citations + trace; ADR-001 §3/§6). */
@Injectable()
export class AiAnswersRepository {
  async insert(db: ScopedClient, tenantId: string, companyId: string, a: InsertAnswerInput): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO ai_answers (id, tenant_id, company_id, question_kind, question_key, question_text, context, status,
                               answer_md, citations, confidence, tool_trace, llm_used, model_version, prompt_version,
                               rule_card_versions, response_ms, asked_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [a.id, tenantId, companyId, a.questionKind, a.questionKey ?? null, a.questionText ?? null, JSON.stringify(a.context), a.status,
       a.answerMd, JSON.stringify(a.citations), a.confidence, JSON.stringify(a.toolTrace), a.llmUsed, a.modelVersion, a.promptVersion,
       JSON.stringify(a.ruleCardVersions), a.responseMs, a.askedBy]);
    return r.rows[0].id;
  }
}
