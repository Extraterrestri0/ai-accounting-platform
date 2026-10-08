import { Injectable } from '@nestjs/common';
import { isValidVatNumberFormat } from '../../masterdata';
import type { ViesProvider, ViesProviderResult } from '../application/vies.provider';

/**
 * Deterministic dev/default VIES provider: decides validity from the EU VAT FORMAT
 * (deterministic-first — Inv. 6). Used when no live VIES endpoint is configured, so
 * the validation flow always completes without an external call. Wiring a real EU,
 * zero-retention VIES endpoint is a config add (VIES_API_URL → HttpViesProvider).
 */
@Injectable()
export class DefaultViesProvider implements ViesProvider {
  async check({ normalized }: { normalized: string; countryCode: string }): Promise<ViesProviderResult> {
    return { valid: isValidVatNumberFormat(normalized), source: 'format', raw: { provider: 'format-fallback' } };
  }
}
