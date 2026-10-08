import { Body, Controller, ForbiddenException, Get, Inject, Param, Put } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { TenantContextService } from '../../../platform';
import type { UpdateAccountMappingsDto } from './dto/masterdata.dto';

/**
 * Per-company posting account configuration.
 *
 *   GET /companies/:id/account-mappings
 *   PUT /companies/:id/account-mappings
 *
 * The platform already resolves the active company from the X-Company-Id header
 * (and RLS scopes every row to it). `:id` MUST equal that active company — this
 * is asserted for a clean 403 (RLS is the hard backstop regardless).
 */
@Controller('companies/:id/account-mappings')
export class AccountMappingsController {
  constructor(
    @Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService,
    private readonly ctx: TenantContextService,
  ) {}

  private assertActiveCompany(id: string): void {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId || c.companyId !== id) {
      throw new ForbiddenException('Path company id does not match the active company.');
    }
  }

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  get(@Param('id') id: string) {
    this.assertActiveCompany(id);
    return this.md.getAccountMappings();
  }

  @Put() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateAccountMappingsDto) {
    this.assertActiveCompany(id);
    return this.md.updateAccountMappings(dto);
  }
}
