import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DateRangeDto } from './dto/date-range.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser, @Query() dto: DateRangeDto) {
    return this.statisticsService.getSummary(user.userId, dto);
  }

  @Get('by-jar')
  getByJar(@CurrentUser() user: AuthUser, @Query() dto: DateRangeDto) {
    return this.statisticsService.getByJar(user.userId, dto);
  }

  @Get('daily')
  getDaily(@CurrentUser() user: AuthUser, @Query() dto: DateRangeDto) {
    return this.statisticsService.getDaily(user.userId, dto);
  }
}
