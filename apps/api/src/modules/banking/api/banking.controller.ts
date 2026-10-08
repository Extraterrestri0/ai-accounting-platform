import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BANK_IMPORT_SERVICE, type IBankImportService } from '../application/bank-import.service.interface';
import { RECONCILIATION_SERVICE, type IReconciliationService } from '../application/reconciliation.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { ConfirmMatchDto, ManualMatchDto, RejectMatchDto } from './dto/banking.dto';
import type { MatchDocumentType } from '../domain/models';

interface UploadedStatementFile { buffer: Buffer; originalname: string; mimetype: string; size: number; }
const DOC_TYPES: MatchDocumentType[] = ['sales_invoice', 'purchase_invoice'];

/** Statement import + reconciliation. Reads BANK_READ; import BANK_MANAGE; matching BANK_RECONCILE. */
@Controller('banking')
export class BankingController {
  constructor(
    @Inject(BANK_IMPORT_SERVICE) private readonly imports: IBankImportService,
    @Inject(RECONCILIATION_SERVICE) private readonly reconcile: IReconciliationService,
  ) {}

  @Post('import') @RequirePermission(PERMISSIONS.BANK_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: UploadedStatementFile | undefined, @Body('bankAccountId') bankAccountId: string, @Body('format') format?: string) {
    if (!file?.buffer) throw new BadRequestException('A statement file is required (multipart field "file").');
    if (!bankAccountId) throw new BadRequestException('bankAccountId is required.');
    return this.imports.importStatement({ bankAccountId, fileName: file.originalname, format, content: file.buffer });
  }

  @Get('statements') @RequirePermission(PERMISSIONS.BANK_READ)
  statements(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.imports.listStatements(page ? Number(page) : 1, pageSize ? Number(pageSize) : 50);
  }

  @Get('transactions') @RequirePermission(PERMISSIONS.BANK_READ)
  transactions(@Query('status') status?: string, @Query('bankAccountId') bankAccountId?: string, @Query('statementId') statementId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.reconcile.listTransactions({ status, bankAccountId, statementId }, page ? Number(page) : 1, pageSize ? Number(pageSize) : 50);
  }

  @Get('transactions/:id/suggestions') @RequirePermission(PERMISSIONS.BANK_READ)
  suggestions(@Param('id') id: string) { return this.reconcile.suggestMatches(id); }

  @Post('transactions/:id/confirm-match') @RequirePermission(PERMISSIONS.BANK_RECONCILE)
  confirm(@Param('id') id: string, @Body() dto: ConfirmMatchDto) {
    this.requireDoc(dto);
    return this.reconcile.confirmMatch(id, dto);
  }

  @Post('transactions/:id/manual-match') @RequirePermission(PERMISSIONS.BANK_RECONCILE)
  manual(@Param('id') id: string, @Body() dto: ManualMatchDto) {
    this.requireDoc(dto);
    return this.reconcile.manualMatch(id, dto);
  }

  @Post('transactions/:id/reject-match') @RequirePermission(PERMISSIONS.BANK_RECONCILE)
  reject(@Param('id') id: string, @Body() dto: RejectMatchDto) { return this.reconcile.rejectMatch(id, dto?.reason); }

  @Get('summary') @RequirePermission(PERMISSIONS.BANK_READ)
  summary() { return this.reconcile.summary(); }

  private requireDoc(dto: { documentType?: string; documentId?: string }): void {
    if (!dto?.documentType || !DOC_TYPES.includes(dto.documentType as MatchDocumentType)) throw new BadRequestException('documentType must be sales_invoice or purchase_invoice.');
    if (!dto.documentId) throw new BadRequestException('documentId is required.');
  }
}
