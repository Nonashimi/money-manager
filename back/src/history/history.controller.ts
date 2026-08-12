import { Controller, Get, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.historyService.findAll(user.userId);
  }

  @Post('undo')
  undoLast(@CurrentUser() user: AuthUser) {
    return this.historyService.undoLast(user.userId);
  }
}
