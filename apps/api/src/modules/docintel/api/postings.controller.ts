import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { POSTING_SERVICE, type IPostingService } from '../application/posting.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { ReverseDto } from './dto/postings.dto';

/** Posting workflow: post an approved review to the ledger; reverse a posted entry. Human-only. */
@Controller()
export class PostingsController {
  constructor(@Inject(POSTING_SERVICE) private readonly posting: IPostingService) {}

  @Post('reviews/:packageId/post') @RequirePermission(PERMISSIONS.LEDGER_POST)
  post(@Param('packageId') packageId: string) { return this.posting.postFromReview(packageId); }

  @Get('reviews/:packageId/posting') @RequirePermission(PERMISSIONS.COMPANY_READ)
  getForReview(@Param('packageId') packageId: string) { return this.posting.getPostingForReview(packageId); }

  @Post('ledger/entries/:entryId/reverse') @RequirePermission(PERMISSIONS.LEDGER_REVERSE)
  reverse(@Param('entryId') entryId: string, @Body() dto: ReverseDto) { return this.posting.reverse(entryId, dto.reason); }

  @Get('postings') @RequirePermission(PERMISSIONS.COMPANY_READ)
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.posting.listPostings(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined); }
}
