import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { normHeader } from '../../domain/normalize';
import type { ParsedRow } from '../../domain/models';
import type { StatementParser } from '../../application/statement-parser.port';

/** Convert a cell to a canonical string (dates → YYYY-MM-DD using local components). */
function cell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).trim();
}

/** XLSX parser (SheetJS) — first worksheet, first row = headers. */
@Injectable()
export class XlsxStatementParser implements StatementParser {
  readonly format = 'xlsx';

  parse(content: Buffer): ParsedRow[] {
    const wb = XLSX.read(content, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });
    if (matrix.length === 0) return [];
    const headers = (matrix[0] as unknown[]).map((h) => normHeader(cell(h)));
    const rows: ParsedRow[] = [];
    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i] as unknown[];
      if (!cells || cells.every((c) => cell(c) === '')) continue;
      const row: ParsedRow = {};
      headers.forEach((h, idx) => { if (h) row[h] = cell(cells[idx]); });
      rows.push(row);
    }
    return rows;
  }
}
