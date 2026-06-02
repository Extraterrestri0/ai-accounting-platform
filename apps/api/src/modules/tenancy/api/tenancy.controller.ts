import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { TENANCY_SERVICE, type ITenancyService } from '../application/tenancy.service.interface';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { CompanyContextDto } from './dto/company-context.dto';

/**
 * Minimal tenancy API: create a company, list my companies, switch active company.
 * Tenant scope is implicit (from session/context). No tenantId is accepted from clients.
 */
@Controller('companies')
export class TenancyController {
  constructor(@Inject(TENANCY_SERVICE) private readonly tenancy: ITenancyService) {}

  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    const c = await this.tenancy.createCompany(dto);
    return { id: c.id, name: c.name, baseCurrency: c.baseCurrency };
  }

  @Get()
  async listMine() {
    return this.tenancy.listMyCompanies();
  }

  /** Company switch — succeeds only for companies the user is assigned to. */
  @Post(':id/switch')
  async switch(@Param('id') id: string): Promise<CompanyContextDto> {
    const c = await this.tenancy.switchCompany(id);
    return { companyId: c.id, name: c.name, baseCurrency: c.baseCurrency };
  }
}
