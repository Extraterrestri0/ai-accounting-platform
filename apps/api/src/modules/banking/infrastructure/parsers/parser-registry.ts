import { Injectable } from '@nestjs/common';
import { UnsupportedFormatError } from '../../domain/errors';
import { CsvStatementParser } from './csv-parser';
import { XlsxStatementParser } from './xlsx-parser';
import type { IStatementParserRegistry, StatementParser } from '../../application/statement-parser.port';

/**
 * Registry of statement parsers keyed by format. Phase-1: csv + xlsx. To add MT940
 * or CAMT.053, implement StatementParser and register it here — nothing else changes.
 */
@Injectable()
export class StatementParserRegistry implements IStatementParserRegistry {
  private readonly parsers = new Map<string, StatementParser>();

  constructor(csv: CsvStatementParser, xlsx: XlsxStatementParser) {
    for (const p of [csv, xlsx]) this.parsers.set(p.format, p);
  }

  get(format: string): StatementParser {
    const p = this.parsers.get(format.toLowerCase());
    if (!p) throw new UnsupportedFormatError(format);
    return p;
  }
  supported(): string[] { return [...this.parsers.keys()]; }
}
