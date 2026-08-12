import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferService } from './transfer.service';

@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.transferService.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) {
    return this.transferService.create(user.userId, dto);
  }
}
