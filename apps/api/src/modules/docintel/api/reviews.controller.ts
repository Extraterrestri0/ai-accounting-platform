import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { REVIEW_SERVICE, type IReviewService } from '../application/review.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { ApproveDto, RejectDto, CorrectionDto, EditReviewDto, AssignDto, CommentDto } from './dto/reviews.dto';
import type { ReviewStatus } from '../domain/review/models';

/** Review Queue endpoints. Decisions require REVIEW_APPROVE (human) — enforced by the global guard + DB. */
@Controller('reviews')
export class ReviewsController {
  constructor(@Inject(REVIEW_SERVICE) private readonly reviews: IReviewService) {}

  @Get('queue') @RequirePermission(PERMISSIONS.COMPANY_READ)
  queue(@Query('status') status?: ReviewStatus, @Query('assignedToMe') mine?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.reviews.listQueue({ status, assignedToMe: mine === 'true', page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
  }

  @Get('dashboard') @RequirePermission(PERMISSIONS.COMPANY_READ)
  dashboard() { return this.reviews.dashboard(); }

  @Post('documents/:documentId') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  create(@Param('documentId') documentId: string) { return this.reviews.createPackage(documentId); }

  @Get('documents/:documentId') @RequirePermission(PERMISSIONS.COMPANY_READ)
  detail(@Param('documentId') documentId: string) { return this.reviews.getDetail(documentId); }

  @Post(':id/approve') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  approve(@Param('id') id: string, @Body() dto: ApproveDto) { return this.reviews.approve(id, dto.comment); }

  @Post(':id/reject') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectDto) { return this.reviews.reject(id, dto.reason); }

  @Post(':id/request-correction') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  correction(@Param('id') id: string, @Body() dto: CorrectionDto) { return this.reviews.requestCorrection(id, dto.note); }

  @Post(':id/edit') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  edit(@Param('id') id: string, @Body() dto: EditReviewDto) { return this.reviews.edit(id, dto); }

  @Post(':id/fields') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  editFields(@Param('id') id: string, @Body() dto: { fields: Record<string, string> }) { return this.reviews.editFields(id, dto?.fields ?? {}); }

  @Post(':id/assign') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  assign(@Param('id') id: string, @Body() dto: AssignDto) { return this.reviews.assignReviewer(id, dto.reviewerId); }

  @Post(':id/comment') @RequirePermission(PERMISSIONS.COMPANY_READ)
  comment(@Param('id') id: string, @Body() dto: CommentDto) { return this.reviews.addComment(id, dto.body); }
}
