/** Review-queue domain models. Decisions are HUMAN-only (Invariant 4/5). */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_correction';
export type ReviewActionType = 'approve' | 'reject' | 'edit' | 'request_correction' | 'assign' | 'comment';

export interface ReviewPackage {
  id: string; documentId: string; extractionId?: string; accountingSuggestionId?: string;
  status: ReviewStatus; assignedReviewerId?: string;
  approvedAccountId?: string; approvedVatCodeId?: string; approvedPosting?: unknown;
  decidedBy?: string; decidedAt?: string; createdAt: string;
}
export interface ReviewQueueItem {
  id: string; documentId: string; filename: string; status: ReviewStatus;
  assignedReviewerId?: string; confidence?: number; isDuplicate: boolean; createdAt: string;
}
export interface ReviewComment { id: string; authorId: string; body: string; createdAt: string; }
export interface ReviewActionLog { id: string; actionType: ReviewActionType; actorId: string; payload?: unknown; createdAt: string; }

/** Full review-detail payload for the Review Detail screen. */
export interface ReviewDetail {
  package: ReviewPackage;
  documentDownloadUrl?: string;
  extraction: { overallConfidence: number; fields: { key: string; valueText?: string; confidence: number; validationStatus: string }[]; flags: unknown; diagnostics?: unknown };
  suggestion: unknown | null;     // AccountingSuggestion from the rules engine
  comments: ReviewComment[];
  actions: ReviewActionLog[];
}
export interface ReviewerDashboard {
  pending: number; needsCorrection: number; approved: number; rejected: number; assignedToMe: number;
}
