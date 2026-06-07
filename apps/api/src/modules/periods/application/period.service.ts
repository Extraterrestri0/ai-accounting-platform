import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { PeriodRepository } from '../infrastructure/period.repository';
import { assertValidYm, periodKey, recentMonths, ymOf } from '../domain/period';
import { PeriodLockedError } from '../domain/errors';
import { PeriodEvents } from '../events';
import type { AccountingPeriod } from '../domain/models';
import type { IAccountingPeriodService } from './period.service.interface';

@Injectable()
export class AccountingPeriodService implements IAccountingPeriodService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: PeriodRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ForbiddenException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('Managing periods requires a human (AI cannot lock periods).');
    return userId;
  }
  private current(): { year: number; month: number } {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  async assertOpen(dateISO: string, what = 'Operation'): Promise<void> {
    const { year, month } = ymOf(dateISO);
    if (await this.isPeriodLocked(year, month)) throw new PeriodLockedError(year, month, what);
  }

  async isPeriodLocked(year: number, month: number): Promise<boolean> {
    const { companyId } = this.scope();
    const row = await this.db.run((db) => this.repo.find(db, companyId, year, month, this.current()));
    return row?.status === 'locked';
  }

  async lockPeriod(year: number, month: number): Promise<AccountingPeriod> {
    assertValidYm(year, month);
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    await this.db.run(async (db) => {
      await this.repo.upsert(db, tenantId, companyId, year, month, 'locked', userId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId, action: PeriodEvents.PeriodLocked,
        entityType: 'accounting_period', entityId: undefined,
        after: { year, month, period: periodKey(year, month), status: 'locked' },
      });
    });
    return this.getPeriod(year, month);
  }

  async openPeriod(year: number, month: number): Promise<AccountingPeriod> {
    assertValidYm(year, month);
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();
    await this.db.run(async (db) => {
      await this.repo.upsert(db, tenantId, companyId, year, month, 'open', userId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId, action: PeriodEvents.PeriodOpened,
        entityType: 'accounting_period', entityId: undefined,
        after: { year, month, period: periodKey(year, month), status: 'open' },
      });
    });
    return this.getPeriod(year, month);
  }

  async getCurrentPeriod(): Promise<AccountingPeriod> {
    const { year, month } = this.current();
    return this.getPeriod(year, month);
  }

  async listPeriods(months = 12): Promise<AccountingPeriod[]> {
    const { companyId } = this.scope();
    const cur = this.current();
    const stored = await this.db.run((db) => this.repo.list(db, companyId, cur));
    const byKey = new Map(stored.map((p) => [p.key, p]));
    const window = recentMonths(cur.year, cur.month, Math.min(60, Math.max(1, months)));
    const result: AccountingPeriod[] = window.map((w) => byKey.get(periodKey(w.year, w.month)) ?? this.synth(w.year, w.month, cur));
    // include any stored (e.g. locked) periods OUTSIDE the window
    const windowKeys = new Set(window.map((w) => periodKey(w.year, w.month)));
    for (const p of stored) if (!windowKeys.has(p.key)) result.push(p);
    result.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
    return result;
  }

  private synth(year: number, month: number, cur: { year: number; month: number }): AccountingPeriod {
    return { year, month, key: periodKey(year, month), status: 'open', isCurrent: year === cur.year && month === cur.month };
  }

  private async getPeriod(year: number, month: number): Promise<AccountingPeriod> {
    const { companyId } = this.scope();
    const cur = this.current();
    const row = await this.db.run((db) => this.repo.find(db, companyId, year, month, cur));
    return row ?? this.synth(year, month, cur);
  }
}
