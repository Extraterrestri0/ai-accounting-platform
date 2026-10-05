import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { LEDGER_SERVICE, type ILedgerService } from '../application/ledger.service.interface';
import { PostEntryDto, ReverseEntryDto } from './dto/post-entry.dto';
import { RequirePermission, PERMISSIONS } from '../../identity';

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
  post(@Body() dto: PostEntryDto) { return this.ledger.postEntry(dto); }

  @Post(':id/reverse') @RequirePermission(PERMISSIONS.LEDGER_REVERSE)
  reverse(@Param('id') id: string, @Body() dto: ReverseEntryDto) {
    return this.ledger.reverseEntry(id, dto.reason);
  }

  @Get(':id') @RequirePermission(PERMISSIONS.LEDGER_READ)
  get(@Param('id') id: string) { return this.ledger.getEntry(id); }

  @Get() @RequirePermission(PERMISSIONS.LEDGER_READ)
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ledger.listEntries(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }
}
