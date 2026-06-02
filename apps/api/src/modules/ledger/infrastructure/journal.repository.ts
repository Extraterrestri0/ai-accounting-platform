import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { Direction, JournalEntry, JournalLine } from '../domain/models';

interface EntryRow {
  id: string; tenant_id: string; company_id: string; entry_no: string; posting_date: string;
  description: string; source_type: string; source_ref: string | null; currency: string;
  status: string; reverses_entry_id: string | null; created_by_actor_type: string;
  created_by_actor_id: string | null; created_at: string;
}
interface LineRow {
  id: string; entry_id: string; line_no: number; account_id: string;
  direction: Direction; amount: string; currency: string; narrative: string | null;
}

@Injectable()
export class JournalRepository {
  /** Atomically allocate the next per-company entry number. */
  async nextEntryNo(db: ScopedClient, tenantId: string, companyId: string): Promise<number> {
    const res = await db.query<{ next_no: string }>(
      `INSERT INTO ledger_entry_counters (tenant_id, company_id, next_no)
       VALUES ($1, $2, 1)
       ON CONFLICT (tenant_id, company_id)
       DO UPDATE SET next_no = ledger_entry_counters.next_no + 1
       RETURNING next_no`,
      [tenantId, companyId],
    );
    return Number(res.rows[0].next_no);
  }

  async insertEntry(db: ScopedClient, e: {
    tenantId: string; companyId: string; entryNo: number; postingDate: string;
    description: string; sourceType: string; sourceRef?: string; currency: string;
    reversesEntryId?: string; actorType: string; actorId?: string;
  }): Promise<string> {
    const res = await db.query<{ id: string }>(
      `INSERT INTO journal_entries
         (tenant_id, company_id, entry_no, posting_date, description, source_type, source_ref,
          currency, reverses_entry_id, created_by_actor_type, created_by_actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [e.tenantId, e.companyId, e.entryNo, e.postingDate, e.description, e.sourceType,
       e.sourceRef ?? null, e.currency, e.reversesEntryId ?? null, e.actorType, e.actorId ?? null],
    );
    return res.rows[0].id;
  }

  async insertLines(db: ScopedClient, p: {
    tenantId: string; companyId: string; entryId: string; currency: string;
    lines: { accountId: string; direction: Direction; amount: string; narrative?: string }[];
  }): Promise<void> {
    let n = 0;
    for (const l of p.lines) {
      n += 1;
      await db.query(
        `INSERT INTO journal_lines
           (tenant_id, company_id, entry_id, line_no, account_id, direction, amount, currency, narrative)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [p.tenantId, p.companyId, p.entryId, n, l.accountId, l.direction, l.amount, p.currency, l.narrative ?? null],
      );
    }
  }

  async isReversed(db: ScopedClient, entryId: string): Promise<boolean> {
    const r = await db.query<{ ok: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM journal_entries WHERE reverses_entry_id = $1) AS ok`, [entryId]);
    return r.rows[0]?.ok === true;
  }

  async getEntry(db: ScopedClient, entryId: string): Promise<JournalEntry | null> {
    const e = await db.query<EntryRow>(`SELECT * FROM journal_entries WHERE id = $1`, [entryId]);
    if (!e.rows[0]) return null;
    const l = await db.query<LineRow>(
      `SELECT * FROM journal_lines WHERE entry_id = $1 ORDER BY line_no`, [entryId]);
    return this.map(e.rows[0], l.rows);
  }

  async listEntries(db: ScopedClient, limit: number, offset: number): Promise<JournalEntry[]> {
    const e = await db.query<EntryRow>(
      `SELECT * FROM journal_entries ORDER BY entry_no DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const out: JournalEntry[] = [];
    for (const row of e.rows) {
      const l = await db.query<LineRow>(
        `SELECT * FROM journal_lines WHERE entry_id = $1 ORDER BY line_no`, [row.id]);
      out.push(this.map(row, l.rows));
    }
    return out;
  }

  private map(e: EntryRow, lines: LineRow[]): JournalEntry {
    return {
      id: e.id, tenantId: e.tenant_id, companyId: e.company_id, entryNo: Number(e.entry_no),
      postingDate: e.posting_date, description: e.description, sourceType: e.source_type,
      sourceRef: e.source_ref ?? undefined, currency: e.currency, status: e.status,
      reversesEntryId: e.reverses_entry_id ?? undefined, createdByActorType: e.created_by_actor_type,
      createdByActorId: e.created_by_actor_id ?? undefined, createdAt: e.created_at,
      lines: lines.map((r): JournalLine => ({
        id: r.id, entryId: r.entry_id, lineNo: r.line_no, accountId: r.account_id,
        direction: r.direction, amount: r.amount, currency: r.currency,
        narrative: r.narrative ?? undefined,
      })),
    };
  }
}
