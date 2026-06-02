import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { LEDGER_SERVICE, type ILedgerService } from '../application/ledger.service.interface';
import type { PostEntryDto, ReverseEntryDto } from './dto/post-entry.dto';

/** Minimal ledger API. Company context must be active (set via company switch). */
@Controller('ledger/entries')
export class LedgerController {
  constructor(@Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService) {}

  @Post()
  post(@Body() dto: PostEntryDto) { return this.ledger.postEntry(dto); }

  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseEntryDto) {
    return this.ledger.reverseEntry(id, dto.reason);
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.ledger.getEntry(id); }

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.ledger.listEntries(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }
}
