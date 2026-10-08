import type { ApplicationService } from '../../../shared-kernel';
import type { AskRequest, AssistantAnswer, AssistantSurface, QuestionCatalogEntry } from '../domain/models';

/** PUBLIC API of the assistant context (read-only; ADR-001). */
export interface IAssistantService extends ApplicationService {
  ask(request: AskRequest): Promise<AssistantAnswer>;
  questions(surface?: AssistantSurface): QuestionCatalogEntry[];
}

export const ASSISTANT_SERVICE = Symbol('Assistant.Service');
