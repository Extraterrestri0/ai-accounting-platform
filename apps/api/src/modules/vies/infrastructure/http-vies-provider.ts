import { Injectable, Logger } from '@nestjs/common';
import type { ViesProvider, ViesProviderResult } from '../application/vies.provider';

/**
 * Live VIES provider — calls a configured EU, zero-retention VIES endpoint/proxy.
 * Contract: POST { countryCode, vatNumber, fullVatNumber } → { valid, name?, address? }.
 * Config: VIES_API_URL (+ optional VIES_API_KEY). EU residency is the operator's
 * responsibility (point it at an EU-hosted proxy of the official VIES SOAP service).
 */
@Injectable()
export class HttpViesProvider implements ViesProvider {
  private readonly log = new Logger('VIES.Http');
  private readonly url = process.env.VIES_API_URL ?? '';
  private readonly key = process.env.VIES_API_KEY ?? '';

  async check({ normalized, countryCode }: { normalized: string; countryCode: string }): Promise<ViesProviderResult> {
    const vatNumber = normalized.replace(/^[A-Z]{2}/, '');
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}) },
      body: JSON.stringify({ countryCode, vatNumber, fullVatNumber: normalized }),
    });
    if (!res.ok) {
      this.log.warn(`VIES endpoint returned ${res.status}`);
      throw new Error(`VIES service error (${res.status}).`);
    }
    const data = (await res.json()) as { valid?: boolean; name?: string; address?: string };
    return { valid: !!data.valid, name: data.name, address: data.address, source: 'live', raw: data };
  }
}
