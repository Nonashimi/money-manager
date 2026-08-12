import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';

interface Split {
  jarId: string;
  percent: Prisma.Decimal;
  amount: Prisma.Decimal;
}

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  findAll(userId: string) {
    return this.prisma.income.findMany({
      where: { userId },
      include: { allocations: true },
      orderBy: { date: 'desc' },
    });
  }

  async create(userId: string, dto: CreateIncomeDto) {
    const amount = new Prisma.Decimal(dto.amount);

    return this.ledger.transaction(async (tx) => {
      const activeJars = await tx.jar.findMany({ where: { userId, archived: false } });
      if (activeJars.length === 0) {
        throw new BadRequestException('Create at least one jar before recording income');
      }

      const percentSource = dto.allocations
        ? dto.allocations.map((a) => ({ jarId: a.jarId, percent: new Prisma.Decimal(a.percent) }))
        : activeJars.map((j) => ({ jarId: j.id, percent: j.defaultPercent }));

      const activeIds = new Set(activeJars.map((j) => j.id));
      for (const entry of percentSource) {
        if (!activeIds.has(entry.jarId)) {
          throw new BadRequestException(`Jar ${entry.jarId} does not belong to the user or is archived`);
        }
      }

      const percentTotal = percentSource.reduce((sum, e) => sum.plus(e.percent), new Prisma.Decimal(0));
      if (percentTotal.isZero()) {
        throw new BadRequestException('Allocation percentages sum to zero');
      }
      if (percentTotal.minus(100).abs().greaterThan(0.5)) {
        throw new BadRequestException('Allocation percentages must sum to 100');
      }

      const splits = this.distributeAmount(amount, percentSource, percentTotal);

      const income = await tx.income.create({
        data: {
          userId,
          amount,
          description: dto.description,
          source: dto.source,
          date: dto.date ? new Date(dto.date) : new Date(),
          allocations: {
            create: splits.map((s) => ({ jarId: s.jarId, amount: s.amount, percent: s.percent })),
          },
        },
        include: { allocations: true },
      });

      for (const split of splits) {
        await this.ledger.adjustJarBalance(tx, userId, split.jarId, split.amount);
      }

      await this.ledger.logAction(tx, userId, 'INCOME_CREATE', `Доход ${amount.toString()} распределён по копилкам`, {
        incomeId: income.id,
        splits: splits.map((s) => ({ jarId: s.jarId, amount: s.amount.toString() })),
      });

      return income;
    });
  }

  /** Splits `amount` proportionally by percent, assigning any rounding remainder to the last entry. */
  private distributeAmount(
    amount: Prisma.Decimal,
    entries: { jarId: string; percent: Prisma.Decimal }[],
    percentTotal: Prisma.Decimal,
  ): Split[] {
    const splits: Split[] = [];
    let allocated = new Prisma.Decimal(0);

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const rawAmount = amount.times(entry.percent).dividedBy(percentTotal).toDecimalPlaces(2);
      const splitAmount = isLast ? amount.minus(allocated) : rawAmount;
      allocated = allocated.plus(splitAmount);
      splits.push({ jarId: entry.jarId, percent: entry.percent, amount: splitAmount });
    });

    return splits;
  }
}
