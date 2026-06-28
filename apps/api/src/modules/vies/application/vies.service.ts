import { ForbiddenException, HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { ViesRepository } from '../infrastructure/vies.repository';
import { VIES_PROVIDER, type ViesProvider } from './vies.provider';
import { hasEuPrefix, normalizeVat } from '../domain/vat-number';
import { CounterpartyVatMissingError, InvalidVatNumberError } from '../domain/errors';
import { ViesEvents } from '../events';
import type { ViesDataset, ViesDatasetRow, ViesStatus, ViesValidationResult } from '../domain/models';
import type { ViesCheckRow } from '../infrastructure/vies.repository';
import type { IViesService, ValidateVatInput } from './vies.service.interface';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const toCents = (v: string | number): number => Math.round(Number(v) * 100);
const fromCents = (c: number): string => (c / 100).toFixed(2);

@Injectable()
export class ViesService implements IViesService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: ViesRepository,
    @Inject(VIES_PROVIDER) private readonly provider: ViesProvider,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ForbiddenException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  private actor() { const { userId } = this.scope(); return { actorType: (userId ? 'user' : 'system') as 'user' | 'system', actorId: userId }; }

  async validateVatNumber(input: ValidateVatInput): Promise<ViesValidationResult> {
    const { tenantId, companyId, userId } = this.scope();
    const actorType = userId ? 'user' : 'system';
    const { normalized, countryCode } = normalizeVat(input.vatNumber);
    if (!normalized || !hasEuPrefix(normalized)) throw new InvalidVatNumberError(input.vatNumber);

    await this.db.run((db) => this.audit.append(db, {
      companyId, actorType, actorId: userId, action: ViesEvents.ValidationRequested,
      entityType: 'vies_check', after: { vatNumber: normalized, counterpartyId: input.counterpartyId },
    }));

    // 1) cache
    if (!input.force) {
      const cached = await this.db.run((db) => this.repo.latestFresh(db, companyId, normalized, new Date().toISOString()));
      if (cached) {
        await this.db.run((db) => this.audit.append(db, {
          companyId, actorType, actorId: userId, action: ViesEvents.ValidationCompleted,
          entityType: 'vies_check', entityId: cached.id, after: { vatNumber: normalized, valid: cached.isValid, source: 'cache' },
        }));
        return this.toResult(cached, true, 'cache');
      }
    }

    // 2) live validation → 3) store → 4) normalized result
    try {
      const res = await this.provider.check({ normalized, countryCode });
      const checkedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      const row = await this.db.run(async (db) => {
        const inserted = await this.repo.insert(db, tenantId, companyId, {
          counterpartyId: input.counterpartyId, vatNumber: normalized, countryCode, isValid: res.valid,
          checkedAt, expiresAt, responsePayload: { name: res.name, address: res.address, source: res.source, raw: res.raw },
        });
        await this.audit.append(db, {
          companyId, actorType, actorId: userId, action: ViesEvents.ValidationCompleted,
          entityType: 'vies_check', entityId: inserted.id, after: { vatNumber: normalized, valid: res.valid, source: res.source },
        });
        return inserted;
      });
      return { vatNumber: normalized, countryCode, valid: res.valid, source: res.source, fromCache: false,
        name: res.name, address: res.address, checkedAt: row.checkedAt, expiresAt: row.expiresAt };
    } catch (e) {
      await this.db.run((db) => this.audit.append(db, {
        companyId, actorType, actorId: userId, action: ViesEvents.ValidationFailed,
        entityType: 'vies_check', after: { vatNumber: normalized, error: (e as Error).message },
      }));
      throw e instanceof HttpException ? e : new ServiceUnavailableException('VIES validation is temporarily unavailable.');
    }
  }

  async getCachedResult(vatNumber: string): Promise<ViesValidationResult | null> {
    const { companyId } = this.scope();
    const { normalized } = normalizeVat(vatNumber);
    if (!normalized) return null;
    const cached = await this.db.run((db) => this.repo.latestFresh(db, companyId, normalized, new Date().toISOString()));
    return cached ? this.toResult(cached, true, 'cache') : null;
  }

  async refreshValidation(counterpartyId: string): Promise<ViesValidationResult> {
    this.scope(); // ensure an active company (RLS scope) before touching counterparties
    const cp = await this.db.run((db) => this.repo.counterpartyVat(db, counterpartyId));
    if (!cp?.vatNumber) throw new CounterpartyVatMissingError(counterpartyId);
    return this.validateVatNumber({ vatNumber: cp.vatNumber, counterpartyId, force: true });
  }

  async getStatus(counterpartyId: string): Promise<ViesStatus> {
    const { companyId } = this.scope();
    const cp = await this.db.run((db) => this.repo.counterpartyVat(db, counterpartyId));
    if (!cp?.vatNumber) return { counterpartyId, status: 'unchecked', stale: false, countryCode: cp?.countryCode };
    const { normalized, countryCode } = normalizeVat(cp.vatNumber);
    const last = await this.db.run((db) => this.repo.latestForVat(db, companyId, normalized));
    if (!last) return { counterpartyId, vatNumber: normalized, countryCode, status: 'unchecked', stale: false };
    const stale = new Date(last.expiresAt).getTime() <= Date.now();
    return {
      counterpartyId, vatNumber: normalized, countryCode,
      status: last.isValid ? 'valid' : 'invalid', valid: last.isValid,
      name: (last.responsePayload as { name?: string } | undefined)?.name,
      checkedAt: last.checkedAt, expiresAt: last.expiresAt, stale,
    };
  }

  async buildViesDataset(year: number, month: number): Promise<ViesDataset> {
    const { companyId, userId } = this.scope();
    const invoices = await this.db.run((db) => this.repo.euInvoicesForMonth(db, companyId, year, month));
    const rows: ViesDatasetRow[] = invoices.map((i) => {
      const sign = i.documentKind === 'credit_note' ? -1 : 1;
      return {
        counterpartyId: i.counterpartyId, counterpartyName: i.counterpartyName, vatNumber: i.vatNumber,
        countryCode: i.countryCode, invoiceId: i.invoiceId, invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate,
        taxableAmount: fromCents(sign * toCents(i.netTotal)), currency: i.currency,
      };
    });
    const totalTaxable = fromCents(rows.reduce((s, r) => s + toCents(r.taxableAmount), 0));
    await this.db.run((db) => this.audit.append(db, {
      companyId, actorType: userId ? 'user' : 'system', actorId: userId, action: ViesEvents.DatasetGenerated,
      entityType: 'vies_dataset', after: { year, month, count: rows.length, totalTaxable },
    }));
    return { year, month, rows, totalTaxable, count: rows.length };
  }

  private toResult(row: ViesCheckRow, fromCache: boolean, source: ViesValidationResult['source']): ViesValidationResult {
    const payload = row.responsePayload as { name?: string; address?: string } | undefined;
    return {
      vatNumber: row.vatNumber, countryCode: row.countryCode, valid: row.isValid, source, fromCache,
      name: payload?.name, address: payload?.address, checkedAt: row.checkedAt, expiresAt: row.expiresAt,
    };
  }
}
