import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardService } from './board.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { GetBoardDto } from './dto/get-board.dto';
import { ReorderExpensesDto } from './dto/reorder-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  getMonth(@CurrentUser() user: AuthUser, @Query() query: GetBoardDto) {
    return this.boardService.getMonth(user.userId, query.year, query.month);
  }

  @Post('expenses')
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.boardService.createExpense(user.userId, dto);
  }

  @Patch('expenses/reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderExpensesDto) {
    return this.boardService.reorder(user.userId, dto);
  }

  @Patch('expenses/:id')
  updateExpense(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.boardService.updateExpense(user.userId, id, dto);
  }

  @Delete('expenses/:id')
  deleteExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.deleteExpense(user.userId, id);
  }
}
