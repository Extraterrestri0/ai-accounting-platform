import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { EXTRACTION_SERVICE, type IExtractionService } from './extraction.service.interface';
import { RULES_ENGINE_SERVICE, type IRulesEngineService } from './rules-engine.service.interface';
import { DOCUMENT_SERVICE, type IDocumentService } from './document.service.interface';
import { ReviewRepository } from '../infrastructure/review.repository';
import { SuggestionRepository } from '../infrastructure/suggestion.repository';
import type { ReviewDetail, ReviewerDashboard, ReviewPackage, ReviewStatus } from '../domain/review/models';
import type { EditInput, IReviewService, ListQueueQuery } from './review.service.interface';
import { nextStatus } from '../domain/review/workflow';

class ReviewError extends Error {}

@Injectable()
export class ReviewService implements IReviewService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: ReviewRepository,
    private readonly suggestions: SuggestionRepository,
    @Inject(EXTRACTION_SERVICE) private readonly extraction: IExtractionService,
    @Inject(RULES_ENGINE_SERVICE) private readonly engine: IRulesEngineService,
    @Inject(DOCUMENT_SERVICE) private readonly documents: IDocumentService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ReviewError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  /** Decisions require a HUMAN principal. AI/worker identities have no userId — refused (Invariant 4/5). */
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('Review decisions require a human reviewer.');
    return userId;
  }

  async createPackage(documentId: string): Promise<ReviewPackage> {
    const { tenantId, companyId } = this.scope();
    const suggestion = await this.engine.getSuggestion(documentId).catch(() => null);
    const extraction = await this.extraction.getExtraction(documentId).catch(() => null);
    return this.db.run(async (db) => {
      const pkg = await this.repo.create(db, tenantId, companyId, { documentId, extractionId: extraction?.id, accountingSuggestionId: suggestion?.id });
      await this.audit.append(db, { companyId, actorType: 'system', action: 'docintel.review_item_created', entityType: 'review_package', entityId: pkg.id, after: { documentId, status: 'pending' } });
      return pkg;
    });
  }

  async listQueue(q: ListQueueQuery) {
    const { userId } = this.scope();
    const page = Math.max(1, q.page ?? 1); const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const { items, total } = await this.db.run((db) => this.repo.listQueue(db, { status: q.status, assignedTo: q.assignedToMe ? userId : undefined, limit: pageSize, offset: (page - 1) * pageSize }));
    return { items, total, page, pageSize };
  }

  async getDetail(documentId: string): Promise<ReviewDetail> {
    this.scope();
    const pkg = await this.db.run((db) => this.repo.getByDocument(db, documentId));
    if (!pkg) throw new ReviewError(`No review package for document ${documentId}.`);
    const review = await this.extraction.getReviewPackage(documentId);
    const suggestion = await this.engine.getSuggestion(documentId).catch(() => null);
    const downloadUrl = await this.documents.getDownloadUrl(documentId).catch(() => undefined);
    const { comments, actions, corrected } = await this.db.run(async (db) => ({
      comments: await this.repo.listComments(db, pkg.id),
      actions: await this.repo.listActions(db, pkg.id),
      corrected: await this.repo.getCorrectedFields(db, documentId),
    }));
    // Overlay human corrections / added fields on the immutable extraction (display + downstream).
    type DisplayField = { key: string; valueText?: string; confidence: number; validationStatus: string; source: string };
    const byKey = new Map<string, DisplayField>(review.fields.map((f) => [f.key as string, { key: f.key, valueText: f.valueText, confidence: f.confidence, validationStatus: f.validationStatus, source: 'ocr' }]));
    for (const [key, valueText] of Object.entries(corrected)) {
      byKey.set(key, { key, valueText, confidence: 1, validationStatus: 'valid', source: 'human' });
    }
    return {
      package: pkg, documentDownloadUrl: downloadUrl,
      extraction: { overallConfidence: review.overallConfidence, fields: Array.from(byKey.values()), flags: review.flags, diagnostics: review.diagnostics },
      suggestion, comments, actions,
    };
  }

  /** Save human field corrections / added fields onto the review package (audited). */
  async editFields(packageId: string, fields: Record<string, string>): Promise<ReviewPackage> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    return this.db.run(async (db) => {
      const pkg = await this.repo.getById(db, packageId);
      if (!pkg) throw new ReviewError(`Review package ${packageId} not found.`);
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
      await this.repo.setCorrectedFields(db, packageId, cleaned);
      await this.repo.addAction(db, tenantId, companyId, { packageId, actionType: 'edit', actorId: userId, payload: { fields: Object.keys(cleaned) } });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'docintel.review_fields_edited', entityType: 'review_package', entityId: packageId, after: { fields: cleaned } });
      const updated = await this.repo.getById(db, packageId);
      return updated!;
    });
  }

  private async decide(packageId: string, status: ReviewStatus, actionType: 'approve' | 'reject' | 'request_correction', payload: Record<string, unknown>, suggestionStatus?: 'accepted' | 'rejected'): Promise<ReviewPackage> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    return this.db.run(async (db) => {
      const pkg = await this.repo.getById(db, packageId);
      if (!pkg) throw new ReviewError(`Review package ${packageId} not found.`);
      const currentSuggestion = status === 'approved' && pkg.accountingSuggestionId
        ? await this.suggestions.getCurrent(db, pkg.documentId)
        : null;
      const approved = currentSuggestion ? { accountId: undefined, posting: currentSuggestion.suggestedPosting } : undefined;
      const resolved = nextStatus(actionType, pkg.status); void resolved;
      await this.repo.setDecision(db, packageId, status, userId, approved);
      await this.repo.addAction(db, tenantId, companyId, { packageId, actionType, actorId: userId, payload });
      if (suggestionStatus && pkg.accountingSuggestionId) await this.repo.markSuggestion(db, pkg.accountingSuggestionId, suggestionStatus);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: `docintel.review_${actionType}`, entityType: 'review_package', entityId: packageId, after: { status, ...payload } });
      // Task 1.2: record approval of the (possibly reviewer-changed) expense category.
      if (status === 'approved' && currentSuggestion?.expenseCategory) {
        await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'expense.category_approved', entityType: 'accounting_suggestion', entityId: currentSuggestion.id, after: { category: currentSuggestion.expenseCategory.code, confidence: currentSuggestion.classification?.confidence, source: currentSuggestion.classification?.source } });
      }
      const updated = await this.repo.getById(db, packageId);
      return updated!;
    });
  }

  approve(packageId: string, comment?: string): Promise<ReviewPackage> { return this.decide(packageId, 'approved', 'approve', comment ? { comment } : {}, 'accepted'); }
  reject(packageId: string, reason: string): Promise<ReviewPackage> { return this.decide(packageId, 'rejected', 'reject', { reason }, 'rejected'); }
  requestCorrection(packageId: string, note: string): Promise<ReviewPackage> { return this.decide(packageId, 'needs_correction', 'request_correction', { note }); }

  async edit(packageId: string, input: EditInput): Promise<ReviewPackage> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    return this.db.run(async (db) => {
      const pkg = await this.repo.getById(db, packageId);
      if (!pkg) throw new ReviewError(`Review package ${packageId} not found.`);
      const accountId = input.accountCode ? await this.suggestions.accountIdByCode(db, input.accountCode) : undefined;
      await this.repo.setDecision(db, packageId, pkg.status, userId, { accountId: accountId ?? undefined, vatCodeId: input.vatCodeId, posting: input.posting });
      await this.repo.addAction(db, tenantId, companyId, { packageId, actionType: 'edit', actorId: userId, payload: { ...input } });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'docintel.review_edit', entityType: 'review_package', entityId: packageId, before: { account: pkg.approvedAccountId }, after: { ...input } });
      const updated = await this.repo.getById(db, packageId);
      return updated!;
    });
  }

  async assignReviewer(packageId: string, reviewerId: string): Promise<ReviewPackage> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    return this.db.run(async (db) => {
      await this.repo.assign(db, packageId, reviewerId);
      await this.repo.addAction(db, tenantId, companyId, { packageId, actionType: 'assign', actorId: userId, payload: { reviewerId } });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'docintel.review_assign', entityType: 'review_package', entityId: packageId, after: { reviewerId } });
      const updated = await this.repo.getById(db, packageId);
      if (!updated) throw new ReviewError(`Review package ${packageId} not found.`);
      return updated;
    });
  }

  async addComment(packageId: string, body: string): Promise<void> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    await this.db.run(async (db) => {
      await this.repo.addComment(db, tenantId, companyId, packageId, userId, body);
      await this.repo.addAction(db, tenantId, companyId, { packageId, actionType: 'comment', actorId: userId, payload: { body } });
    });
  }

  dashboard(): Promise<ReviewerDashboard> {
    const { userId } = this.scope();
    return this.db.run((db) => this.repo.dashboard(db, userId));
  }
}
