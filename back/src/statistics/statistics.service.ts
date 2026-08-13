import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeDto } from './dto/date-range.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Expenses are dated by calendar day (`Day.date` is always UTC midnight of that day, see
 * board.service.ts's toCalendarDate), independent of what instant "now" actually is. `to` must
 * cover the *entire* calendar day it names, or a same-day expense added before the current UTC
 * instant catches up to that day's UTC midnight (e.g. the early-morning hours for any UTC+
 * timezone) would fall after `to` and silently vanish from every stats query.
 */
function endOfCalendarDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + MS_PER_DAY - 1);
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Defaults to a `days`-day lookback (30 if unspecified), but never starts before the user's
   * first-ever expense — otherwise a "week"/"month" preset would divide the total by days that
   * predate any history at all, artificially deflating the average. `allTime` skips the lookback
   * window entirely and starts from the first expense itself, uncapped — used for the standalone
   * "average per day" stat, which is meant to stay stable regardless of the period picker.
   * An explicit `from` (the custom date-range picker) bypasses all of this — deliberate user choice.
   */
  private async resolveRange(userId: string, dto: DateRangeDto) {
    const now = dto.to ? new Date(dto.to) : new Date();
    const to = endOfCalendarDay(now);
    if (dto.from) {
      return { from: new Date(dto.from), to };
    }

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const firstExpense = await this.prisma.expense.findFirst({
      where: { day: { month: { userId } } },
      orderBy: { day: { date: 'asc' } },
      include: { day: true },
    });

    if (dto.allTime) {
      return { from: firstExpense?.day.date ?? todayStart, to };
    }

    const lookbackDays = dto.days ?? 30;
    const windowStart = new Date(todayStart.getTime() - (lookbackDays - 1) * MS_PER_DAY);
    const from = firstExpense && firstExpense.day.date.getTime() > windowStart.getTime() ? firstExpense.day.date : windowStart;
    return { from, to };
  }

  private findExpenses(userId: string, from: Date, to: Date) {
    return this.prisma.expense.findMany({
      where: { day: { month: { userId }, date: { gte: from, lte: to } } },
      include: { day: true, jar: true },
    });
  }

  async getSummary(userId: string, dto: DateRangeDto) {
    const { from, to } = await this.resolveRange(userId, dto);
    const expenses = await this.findExpenses(userId, from, to);
    const settings = await this.prisma.settings.findUnique({ where: { userId } });

    const total = expenses.reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));
    const daysInRange = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
    const averagePerDay = daysInRange > 0 ? total.dividedBy(daysInRange).toDecimalPlaces(2) : new Prisma.Decimal(0);
    const dailyNorm = settings?.dailyNorm ?? null;

    return {
      from,
      to,
      daysInRange,
      total: total.toString(),
      averagePerDay: averagePerDay.toString(),
      dailyNorm: dailyNorm?.toString() ?? null,
      overNorm: dailyNorm ? averagePerDay.greaterThan(dailyNorm) : null,
    };
  }

  async getByJar(userId: string, dto: DateRangeDto) {
    const { from, to } = await this.resolveRange(userId, dto);
    const expenses = await this.findExpenses(userId, from, to);

    const totals = new Map<string, { jarId: string; jarName: string; total: Prisma.Decimal }>();
    for (const e of expenses) {
      const entry = totals.get(e.jarId) ?? { jarId: e.jarId, jarName: e.jar.name, total: new Prisma.Decimal(0) };
      entry.total = entry.total.plus(e.amount);
      totals.set(e.jarId, entry);
    }

    return Array.from(totals.values()).map((t) => ({ ...t, total: t.total.toString() }));
  }

  async getDaily(userId: string, dto: DateRangeDto) {
    const { from, to } = await this.resolveRange(userId, dto);
    const expenses = await this.findExpenses(userId, from, to);

    const totals = new Map<string, Prisma.Decimal>();
    for (const e of expenses) {
      const key = e.day.date.toISOString().slice(0, 10);
      totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).plus(e.amount));
    }

    const series: { date: string; total: string }[] = [];
    for (let d = new Date(from); d.getTime() <= to.getTime(); d = new Date(d.getTime() + MS_PER_DAY)) {
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, total: (totals.get(key) ?? new Prisma.Decimal(0)).toString() });
    }

    return series;
  }
}
