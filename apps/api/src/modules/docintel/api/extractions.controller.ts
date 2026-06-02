import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { EXTRACTION_SERVICE, type IExtractionService } from '../application/extraction.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';

/** OCR & extraction endpoints (read + manual trigger). Guarded by the global RBAC guard. */
@Controller('documents/:id')
export class ExtractionsController {
  constructor(@Inject(EXTRACTION_SERVICE) private readonly extraction: IExtractionService) {}

  @Post('extract') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  run(@Param('id') id: string) { return this.extraction.runExtraction(id); }

  @Get('extraction') @RequirePermission(PERMISSIONS.COMPANY_READ)
  get(@Param('id') id: string) { return this.extraction.getExtraction(id); }

  @Get('review-package') @RequirePermission(PERMISSIONS.COMPANY_READ)
  reviewPackage(@Param('id') id: string) { return this.extraction.getReviewPackage(id); }
}
