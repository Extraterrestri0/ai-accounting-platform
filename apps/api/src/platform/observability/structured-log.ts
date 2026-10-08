import { Logger } from '@nestjs/common';

/**
 * PII-free structured logging for the SAF-T export pipeline.
 *
 * §11: logs must never contain sensitive PII. This builder is WHITELIST-based — only the
 * operational fields below are ever emitted, so customer names, monetary amounts, tax IDs,
 * XML/dataset contents, and storage URLs/keys cannot leak even if a caller passes them.
 * Identifiers used for correlation (tenantId/companyId/exportId — opaque UUIDs) are allowed.
 * Error DETAIL is reduced to the error's class name (full messages live only in the DB/audit,
 * which are access-controlled and are not "logs").
 */
const ALLOWED_KEYS = [
  'event', 'exportId', 'tenantId', 'companyId', 'year', 'month',
  'status', 'xsdValid', 'xsdErrorCount', 'glEntries', 'sizeBytes',
  'durationMs', 'renderMs', 'validationMs', 'storageWriteMs',
  'attempt', 'queueDepth', 'errorName',
] as const;

export type SaftLogField = (typeof ALLOWED_KEYS)[number];
export type SaftLogRecord = Partial<Record<SaftLogField, string | number | boolean | null>>;

/** Build a sanitized record: keep only whitelisted, defined keys (drops anything else). */
export function buildSaftLogRecord(fields: Record<string, unknown>): SaftLogRecord {
  const out: SaftLogRecord = {};
  for (const key of ALLOWED_KEYS) {
    const v = fields[key];
    if (v !== undefined) out[key] = v as string | number | boolean | null;
  }
  return out;
}

const logger = new Logger('saft.pipeline');

/** Emit a single structured JSON line through the Nest logger (level error|warn|log). */
export function logSaft(level: 'log' | 'warn' | 'error', fields: Record<string, unknown>): void {
  const line = JSON.stringify(buildSaftLogRecord(fields));
  if (level === 'error') logger.error(line);
  else if (level === 'warn') logger.warn(line);
  else logger.log(line);
}

/** Reduce an unknown error to a safe, PII-free class name for logging. */
export function safeErrorName(e: unknown): string {
  return e instanceof Error && typeof e.name === 'string' && e.name ? e.name : 'Error';
}
