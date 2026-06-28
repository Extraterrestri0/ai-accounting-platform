import { Injectable } from '@nestjs/common';
import { normHeader } from '../../domain/normalize';
import type { ParsedRow } from '../../domain/models';
import type { StatementParser } from '../../application/statement-parser.port';

/** Detect the delimiter from the header line (comma, semicolon, or tab). */
function detectDelimiter(headerLine: string): string {
  const counts = [',', ';', '\t'].map((d) => ({ d, n: headerLine.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ',';
}

/** Tokenize one CSV line honoring double-quoted fields ("" → literal quote). */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** CSV parser — UTF-8 text, header row → canonical lower-cased keys. */
@Injectable()
export class CsvStatementParser implements StatementParser {
  readonly format = 'csv';

  parse(content: Buffer): ParsedRow[] {
    const text = content.toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return [];
    const delim = detectDelimiter(lines[0]);
    const headers = splitLine(lines[0], delim).map(normHeader);
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i], delim);
      const row: ParsedRow = {};
      headers.forEach((h, idx) => { if (h) row[h] = cells[idx] ?? ''; });
      rows.push(row);
    }
    return rows;
  }
}
