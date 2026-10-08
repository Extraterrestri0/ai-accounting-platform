import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { DOCUMENT_SERVICE, type IDocumentService } from '../application/document.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { InitiateUploadDto, FinalizeUploadDto, ScanResultDto } from './dto/documents.dto';
import type { DocumentStatus, DetectedType } from '../domain/models';

/** Upload Center + Document Archive endpoints. Guarded by the global RBAC guard. */
@Controller('documents')
export class DocumentsController {
  constructor(@Inject(DOCUMENT_SERVICE) private readonly docs: IDocumentService) {}

  @Post('initiate') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  initiate(@Body() dto: InitiateUploadDto) {
    return this.docs.initiateUpload({ filename: dto.filename, mimeType: dto.mimeType, declaredSizeBytes: dto.sizeBytes });
  }

  @Post(':id/finalize') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  finalize(@Param('id') id: string, @Body() dto: FinalizeUploadDto) {
    return this.docs.finalizeUpload(id, { checksumSha256: dto.checksumSha256 });
  }

  // Scan-worker callback (system). In prod this route is restricted to the worker identity.
  @Post(':id/scan-result') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  scanResult(@Param('id') id: string, @Body() dto: ScanResultDto) {
    return this.docs.recordScanResult(id, dto.result, dto.engine);
  }

  // Recovery: re-enqueue the scan for a document stuck in 'scanning'/'failed' (e.g. queue was down).
  @Post(':id/rescan') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  rescan(@Param('id') id: string) { return this.docs.requeueScan(id); }

  @Get() @RequirePermission(PERMISSIONS.COMPANY_READ)
  list(@Query('status') status?: DocumentStatus, @Query('type') type?: DetectedType,
       @Query('search') search?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.docs.listDocuments({ status, type, search, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
  }

  @Get(':id') @RequirePermission(PERMISSIONS.COMPANY_READ)
  get(@Param('id') id: string) { return this.docs.getDocument(id); }

  @Get(':id/download-url') @RequirePermission(PERMISSIONS.COMPANY_READ)
  downloadUrl(@Param('id') id: string) { return this.docs.getDownloadUrl(id).then((url) => ({ url })); }

  @Post(':id/trash') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  trash(@Param('id') id: string) { return this.docs.trashDocument(id); }

  @Post(':id/restore') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  restore(@Param('id') id: string) { return this.docs.restoreDocument(id); }

  @Delete(':id') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  purge(@Param('id') id: string) { return this.docs.purgeDocument(id).then(() => ({ ok: true })); }
}
