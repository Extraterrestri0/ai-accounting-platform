import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, Matches,
  MaxLength, ValidateNested,
} from 'class-validator';

/**
 * Runtime-validated request bodies for the ledger write API. The ledger is the only way to
 * write journal entries, so these payloads are validated by the global ValidationPipe
 * (whitelist+transform) before they reach the service: an unparsable date, a bad direction,
 * a non-decimal/negative amount, or fewer than two lines is rejected as 400, not silently
 * posted. No tenant/company fields — those come from the authenticated request context.
 */

/** Exact 2-decimal positive money string, e.g. "190.00" (never float; never negative/zero). */
const MONEY_2DP = /^\d{1,17}\.\d{2}$/;

export class PostEntryLineDto {
  @IsString() @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'accountId must be a UUID' })
  accountId!: string;

  @IsIn(['debit', 'credit'])
  direction!: 'debit' | 'credit';

  @Matches(MONEY_2DP, { message: 'amount must be a positive 2-decimal string, e.g. "190.00"' })
  amount!: string;

  @IsOptional() @IsString() @MaxLength(500)
  narrative?: string;
}

export class PostEntryDto {
  @IsISO8601({ strict: true }, { message: 'postingDate must be an ISO date (YYYY-MM-DD)' })
  postingDate!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  sourceType?: string;

  @IsOptional() @IsString() @MaxLength(200)
  sourceRef?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsArray() @ArrayMinSize(2, { message: 'a journal entry needs at least two lines' })
  @ValidateNested({ each: true }) @Type(() => PostEntryLineDto)
  lines!: PostEntryLineDto[];
}

export class ReverseEntryDto {
  @IsString() @MaxLength(500)
  reason!: string;
}
