import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { Country, Currency } from '../domain/models';

@Injectable()
export class ReferenceRepository {
  async countryExists(db: ScopedClient, code: string): Promise<boolean> {
    const r = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM countries WHERE code=$1`, [code]);
    return Number(r.rows[0].n) > 0;
  }
  async listCountries(db: ScopedClient): Promise<Country[]> {
    const r = await db.query<{ code: string; name: string; is_eu: boolean }>(`SELECT * FROM countries ORDER BY name`);
    return r.rows.map((x) => ({ code: x.code, name: x.name, isEu: x.is_eu }));
  }
  async listCurrencies(db: ScopedClient): Promise<Currency[]> {
    const r = await db.query<{ code: string; name: string; minor_units: number }>(`SELECT * FROM currencies ORDER BY code`);
    return r.rows.map((x) => ({ code: x.code, name: x.name, minorUnits: x.minor_units }));
  }
}
