import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DebtType } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DebtService } from './debt.service';
import { CreateBulkDebtDto } from './dto/create-bulk-debt.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RepayDebtDto } from './dto/repay-debt.dto';

@Controller('debts')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('type') type?: DebtType) {
    return this.debtService.findAll(user.userId, type);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDebtDto) {
    return this.debtService.create(user.userId, dto);
  }

  @Post('bulk')
  createBulk(@CurrentUser() user: AuthUser, @Body() dto: CreateBulkDebtDto) {
    return this.debtService.createBulk(user.userId, dto);
  }

  @Post(':id/repay')
  repay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RepayDebtDto) {
    return this.debtService.repay(user.userId, id, dto);
  }
}
