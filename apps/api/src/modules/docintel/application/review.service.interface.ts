import type { ApplicationService } from '../../../shared-kernel';
import type { ReviewDetail, ReviewerDashboard, ReviewPackage, ReviewQueueItem, ReviewStatus } from '../domain/review/models';

export interface ListQueueQuery { status?: ReviewStatus; assignedToMe?: boolean; page?: number; pageSize?: number; }
export interface EditInput { accountCode?: string; vatCodeId?: string; posting?: unknown; note?: string; }

/** PUBLIC review service — the human approval workflow. Decisions are HUMAN-only. */
export interface IReviewService extends ApplicationService {
  createPackage(documentId: string): Promise<ReviewPackage>;
  listQueue(q: ListQueueQuery): Promise<{ items: ReviewQueueItem[]; total: number; page: number; pageSize: number }>;
  getDetail(documentId: string): Promise<ReviewDetail>;
  approve(packageId: string, comment?: string): Promise<ReviewPackage>;
  reject(packageId: string, reason: string): Promise<ReviewPackage>;
  requestCorrection(packageId: string, note: string): Promise<ReviewPackage>;
  edit(packageId: string, input: EditInput): Promise<ReviewPackage>;
  assignReviewer(packageId: string, reviewerId: string): Promise<ReviewPackage>;
  addComment(packageId: string, body: string): Promise<void>;
  dashboard(): Promise<ReviewerDashboard>;
}
export const REVIEW_SERVICE = Symbol('DocIntel.ReviewService');
