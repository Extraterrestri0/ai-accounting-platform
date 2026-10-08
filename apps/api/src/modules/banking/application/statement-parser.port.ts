import type { ParsedRow, StatementFormat } from '../domain/models';

/**
 * PORT: a bank-statement parser turns raw file bytes into canonical-keyed string rows.
 * Phase-1 implementations: CSV + XLSX. New formats (MT940, CAMT.053) are added by
 * implementing this port and registering the parser — no change to the import service.
 */
export interface StatementParser {
  readonly format: StatementFormat | string;
  parse(content: Buffer): ParsedRow[];
}

/** Resolves the parser for a given format. */
export interface IStatementParserRegistry {
  get(format: string): StatementParser;
  supported(): string[];
}
export const STATEMENT_PARSER_REGISTRY = Symbol('Banking.StatementParserRegistry');
