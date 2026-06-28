import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { DocIntelModule } from '../docintel';
import { TaxModule } from '../tax';
import { PaymentsModule } from '../payments';
import { ReportingModule } from '../reporting';
import { PeriodsModule } from '../periods';
import { IdentityModule } from '../identity';
import { AssistantController } from './api/assistant.controller';
import { AssistantService } from './application/assistant.service';
import { ASSISTANT_SERVICE } from './application/assistant.service.interface';
import { LLM_PROVIDER } from './application/llm.port';
import { AiAnswersRepository } from './infrastructure/ai-answers.repository';
import { createLlmProvider } from './infrastructure/llm-provider.factory';

/**
 * AI Accountant (Module 11, Phase 1 — ADR-001). READ-ONLY by construction:
 * imports expose only read-side application services; the lone write target is the
 * append-only ai_answers table. No posting / approval / locking / submission service
 * exists anywhere in this module's dependency graph.
 */
@Module({
  imports: [IdentityModule, AuditModule, DocIntelModule, TaxModule, PaymentsModule, ReportingModule, PeriodsModule],
  controllers: [AssistantController],
  providers: [
    AiAnswersRepository,
    { provide: LLM_PROVIDER, useFactory: () => createLlmProvider() },
    { provide: ASSISTANT_SERVICE, useClass: AssistantService },
  ],
  exports: [ASSISTANT_SERVICE],
})
export class AssistantModule {}
