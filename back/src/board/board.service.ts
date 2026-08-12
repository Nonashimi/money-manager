import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JarType, Prisma } from '@prisma/client';
import { LedgerService, Tx } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ReorderExpensesDto } from './dto/reorder-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

function toCalendarDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async getMonth(userId: string, year: number, month: number) {
    const monthRow = await this.prisma.month.findUnique({
      where: { userId_year_month: { userId, year, month } },
      include: { days: { include: { expenses: { orderBy: { order: 'asc' } } }, orderBy: { date: 'asc' } } },
    });

    return { year, month, days: monthRow?.days ?? [] };
  }

  async createExpense(userId: string, dto: CreateExpenseDto) {
    const amount = new Prisma.Decimal(dto.amount);
    const date = toCalendarDate(dto.date);

    return this.ledger.transaction(async (tx) => {
      const jar = await tx.jar.findFirst({ where: { id: dto.jarId, userId, archived: false } });
      if (!jar) {
        throw new BadRequestException('Jar not found or archived');
      }
      if (jar.type === JarType.SAVINGS) {
        throw new BadRequestException('Cannot add expenses to a savings jar');
      }

      const day = await this.findOrCreateDay(tx, userId, date);

      const order = dto.order ?? (await tx.expense.count({ where: { dayId: day.id, jarId: dto.jarId } }));

      const expense = await tx.expense.create({
        data: { dayId: day.id, jarId: dto.jarId, amount, description: dto.description, order },
      });

      await this.ledger.adjustJarBalance(tx, userId, dto.jarId, amount.negated());

      await this.ledger.logAction(tx, userId, 'EXPENSE_CREATE', `Расход ${amount.toString()} в «${jar.name}»`, {
        expenseId: expense.id,
        jarId: dto.jarId,
        amount: amount.toString(),
      });

      return expense;
    });
  }

  async updateExpense(userId: string, expenseId: string, dto: UpdateExpenseDto) {
    return this.ledger.transaction(async (tx) => {
      const expense = await this.findOwnedExpense(tx, userId, expenseId);

      const newAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : expense.amount;
      const newJarId = dto.jarId ?? expense.jarId;

      if (newJarId !== expense.jarId) {
        const jar = await tx.jar.findFirst({ where: { id: newJarId, userId, archived: false } });
        if (!jar) {
          throw new BadRequestException('Target jar not found or archived');
        }
        if (jar.type === JarType.SAVINGS) {
          throw new BadRequestException('Cannot move expenses into a savings jar');
        }
      }

      let dayId = expense.dayId;
      if (dto.date) {
        const day = await this.findOrCreateDay(tx, userId, toCalendarDate(dto.date));
        dayId = day.id;
      }

      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          jarId: newJarId,
          dayId,
          amount: newAmount,
          description: dto.description ?? expense.description,
          order: dto.order ?? expense.order,
        },
      });

      if (!newAmount.equals(expense.amount) || newJarId !== expense.jarId) {
        await this.ledger.adjustJarBalance(tx, userId, expense.jarId, expense.amount);
        await this.ledger.adjustJarBalance(tx, userId, newJarId, newAmount.negated());
      }

      await this.ledger.logAction(tx, userId, 'EXPENSE_UPDATE', `Расход обновлён`, {
        expenseId,
        previous: { jarId: expense.jarId, amount: expense.amount.toString() },
        current: { jarId: newJarId, amount: newAmount.toString() },
      });

      return updated;
    });
  }

  async deleteExpense(userId: string, expenseId: string) {
    return this.ledger.transaction(async (tx) => {
      const expense = await this.findOwnedExpense(tx, userId, expenseId);

      await tx.expense.delete({ where: { id: expenseId } });
      await this.ledger.adjustJarBalance(tx, userId, expense.jarId, expense.amount);

      await this.ledger.logAction(tx, userId, 'EXPENSE_DELETE', `Расход удалён`, {
        expenseId,
        jarId: expense.jarId,
        amount: expense.amount.toString(),
        dayId: expense.dayId,
        description: expense.description,
      });

      return { id: expenseId };
    });
  }

  async reorder(userId: string, dto: ReorderExpensesDto) {
    const expenses = await this.prisma.expense.findMany({
      where: { id: { in: dto.expenseIds }, dayId: dto.dayId, jarId: dto.jarId },
      include: { day: { include: { month: true } } },
    });
    if (expenses.length !== dto.expenseIds.length || expenses.some((e) => e.day.month.userId !== userId)) {
      throw new BadRequestException('Invalid expense ids for reorder');
    }

    await this.prisma.$transaction(
      dto.expenseIds.map((id, index) => this.prisma.expense.update({ where: { id }, data: { order: index } })),
    );

    return { ok: true };
  }

  private async findOrCreateDay(tx: Tx, userId: string, date: Date) {
    const month = await tx.month.upsert({
      where: { userId_year_month: { userId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } },
      create: { userId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
      update: {},
    });

    return tx.day.upsert({
      where: { monthId_date: { monthId: month.id, date } },
      create: { monthId: month.id, date },
      update: {},
    });
  }

  private async findOwnedExpense(tx: Tx, userId: string, expenseId: string) {
    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { day: { include: { month: true } } },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.day.month.userId !== userId) {
      throw new ForbiddenException();
    }
    return expense;
  }
}
