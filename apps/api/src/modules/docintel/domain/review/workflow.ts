import type { ReviewActionType, ReviewStatus } from './models';

/** Decision actions map to a resulting status; non-decision actions keep the current status. */
const DECISION_STATUS: Partial<Record<ReviewActionType, ReviewStatus>> = {
  approve: 'approved', reject: 'rejected', request_correction: 'needs_correction',
};
export function nextStatus(action: ReviewActionType, current: ReviewStatus): ReviewStatus {
  return DECISION_STATUS[action] ?? current;
}
/** Every review action is a human decision/annotation — AI/system may never perform them (Invariant 4/5). */
export function requiresHuman(_action: ReviewActionType): boolean { return true; }
export function isDecision(action: ReviewActionType): boolean {
  return action === 'approve' || action === 'reject' || action === 'request_correction';
}
