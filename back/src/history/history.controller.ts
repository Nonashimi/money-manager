import { Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListHistoryDto } from './dto/list-history.dto';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() dto: ListHistoryDto) {
    return this.historyService.findAll(user.userId, dto);
  }

  @Get('types')
  getAvailableTypes(@CurrentUser() user: AuthUser) {
    return this.historyService.getAvailableTypes(user.userId);
  }

  @Post('undo')
  undoLast(@CurrentUser() user: AuthUser) {
    return this.historyService.undoLast(user.userId);
  }
}
