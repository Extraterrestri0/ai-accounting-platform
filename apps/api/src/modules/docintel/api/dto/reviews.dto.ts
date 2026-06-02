import type { ReviewStatus } from '../../domain/review/models';
export interface ApproveDto { comment?: string; }
export interface RejectDto { reason: string; }
export interface CorrectionDto { note: string; }
export interface EditReviewDto { accountCode?: string; vatCodeId?: string; posting?: unknown; note?: string; }
export interface AssignDto { reviewerId: string; }
export interface CommentDto { body: string; }
export interface QueueQueryDto { status?: ReviewStatus; assignedToMe?: boolean; page?: number; pageSize?: number; }
