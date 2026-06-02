import { nextStatus, requiresHuman, isDecision } from '../../src/modules/docintel/domain/review/workflow';
import type { ReviewActionType } from '../../src/modules/docintel/domain/review/models';

describe('review workflow rules', () => {
  it('maps decision actions to statuses', () => {
    expect(nextStatus('approve', 'pending')).toBe('approved');
    expect(nextStatus('reject', 'pending')).toBe('rejected');
    expect(nextStatus('request_correction', 'pending')).toBe('needs_correction');
  });
  it('non-decision actions keep current status', () => {
    expect(nextStatus('assign', 'pending')).toBe('pending');
    expect(nextStatus('comment', 'approved')).toBe('approved');
    expect(nextStatus('edit', 'needs_correction')).toBe('needs_correction');
  });
  it('every action requires a human (AI cannot approve/reject/edit)', () => {
    (['approve', 'reject', 'edit', 'request_correction', 'assign', 'comment'] as ReviewActionType[])
      .forEach((a) => expect(requiresHuman(a)).toBe(true));
  });
  it('classifies decisions', () => {
    expect(isDecision('approve')).toBe(true);
    expect(isDecision('comment')).toBe(false);
  });
});
