import { Body, Controller, Get, Headers, Inject, Param, Post, Query, UseFilters } from '@nestjs/common';
import { LedgerConflictFilter } from './ledger-error.filter';
import { LEDGER_SERVICE, type ILedgerService } from '../application/ledger.service.interface';
import { PostEntryDto, ReverseEntryDto } from './dto/post-entry.dto';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { requireIdempotencyKey } from '../../../platform';

/**
 * Ledger API — the only HTTP surface that writes journal entries. Every route is
 * re-authorized on the server against the caller's effective permission for the active
 * company (UI hints are never trusted, Invariant 9): posting/reversing require the dedicated
 * ledger.post / ledger.reverse permissions, so a viewer or an accountant without them cannot
 * write to the ledger even though company context is set. Company context must be active.
 */
@Controller('ledger/entries')
export class LedgerController {
  constructor(@Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService) {}

  @Post() @RequirePermission(PERMISSIONS.LEDGER_POST)
  post(@Body() dto: PostEntryDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.ledger.postEntry(dto, { key: requireIdempotencyKey(idempotencyKey) });
  }

  @Post(':id/reverse') @RequirePermission(PERMISSIONS.LEDGER_REVERSE) @UseFilters(LedgerConflictFilter)
  reverse(@Param('id') id: string, @Body() dto: ReverseEntryDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.ledger.reverseEntry(id, dto.reason, { key: requireIdempotencyKey(idempotencyKey) });
  }

  @Get(':id') @RequirePermission(PERMISSIONS.LEDGER_READ)
  get(@Param('id') id: string) { return this.ledger.getEntry(id); }

  @Get() @RequirePermission(PERMISSIONS.LEDGER_READ)
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ledger.listEntries(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }
}
