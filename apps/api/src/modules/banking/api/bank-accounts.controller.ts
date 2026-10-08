import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { BANK_ACCOUNT_SERVICE, type IBankAccountService } from '../application/bank-account.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateBankAccountDto, UpdateBankAccountDto } from './dto/banking.dto';

/** Bank account management. List is BANK_READ; mutations are BANK_MANAGE. */
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(@Inject(BANK_ACCOUNT_SERVICE) private readonly accounts: IBankAccountService) {}

  @Get() @RequirePermission(PERMISSIONS.BANK_READ)
  list() { return this.accounts.listAccounts(); }

  @Post() @RequirePermission(PERMISSIONS.BANK_MANAGE)
  create(@Body() dto: CreateBankAccountDto) { return this.accounts.createAccount(dto); }

  @Patch(':id') @RequirePermission(PERMISSIONS.BANK_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) { return this.accounts.updateAccount(id, dto); }

  @Post(':id/set-primary') @RequirePermission(PERMISSIONS.BANK_MANAGE)
  setPrimary(@Param('id') id: string) { return this.accounts.setPrimary(id); }
}
