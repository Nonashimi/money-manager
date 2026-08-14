import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtStatus, DebtType, Prisma } from '@prisma/client';
import { LedgerService, Tx } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

interface JarAmountEntry {
  jarId: string;
  amount: string;
}

@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async findAll(
    userId: string,
    opts: { page?: number; pageSize?: number; types?: string[]; includeUndone?: boolean } = {},
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where: Prisma.HistoryActionWhereInput = {
      userId,
      ...(opts.types?.length ? { type: { in: opts.types } } : {}),
      ...(opts.includeUndone === false ? { undone: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.historyAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.historyAction.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Every action type the user has ever logged — powers the filter modal's checkbox list, independent of the current page/filter. */
  async getAvailableTypes(userId: string) {
    const rows = await this.prisma.historyAction.findMany({
      where: { userId },
      distinct: ['type'],
      select: { type: true },
    });
    return rows.map((r) => r.type);
  }

  async undoLast(userId: string) {
    return this.ledger.transaction(async (tx) => {
      const action = await tx.historyAction.findFirst({
        where: { userId, undone: false },
        orderBy: { createdAt: 'desc' },
      });
      if (!action) {
        throw new NotFoundException('Nothing to undo');
      }

      const payload = action.payload as Record<string, unknown>;

      switch (action.type) {
        case 'INCOME_CREATE':
          await this.undoIncomeCreate(tx, userId, payload);
          break;
        case 'EXPENSE_CREATE':
          await this.undoExpenseCreate(tx, userId, payload);
          break;
        case 'EXPENSE_UPDATE':
          await this.undoExpenseUpdate(tx, userId, payload);
          break;
        case 'EXPENSE_DELETE':
          await this.undoExpenseDelete(tx, userId, payload);
          break;
        case 'TRANSFER_CREATE':
          await this.undoTransferCreate(tx, userId, payload);
          break;
        case 'DEBT_CREATE':
          await this.undoDebtCreate(tx, userId, payload);
          break;
        case 'DEBT_CREATE_BULK':
          await this.undoDebtCreateBulk(tx, userId, payload);
          break;
        case 'DEBT_REPAY':
        case 'DEBT_FORGIVE':
          await this.undoDebtRepayment(tx, userId, payload);
          break;
        default:
          throw new BadRequestException(`Action type ${action.type} cannot be undone`);
      }

      await tx.historyAction.update({ where: { id: action.id }, data: { undone: true } });

      return { undone: action };
    });
  }

  private async undoIncomeCreate(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const incomeId = payload.incomeId as string;
    const splits = payload.splits as JarAmountEntry[];

    for (const split of splits) {
      await this.ledger.adjustJarBalance(tx, userId, split.jarId, new Prisma.Decimal(split.amount).negated());
    }
    await tx.income.delete({ where: { id: incomeId } });
  }

  private async undoExpenseCreate(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const expenseId = payload.expenseId as string;
    const jarId = payload.jarId as string;
    const amount = new Prisma.Decimal(payload.amount as string);

    await this.ledger.adjustJarBalance(tx, userId, jarId, amount);
    await tx.expense.delete({ where: { id: expenseId } });
  }

  private async undoExpenseUpdate(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const expenseId = payload.expenseId as string;
    const previous = payload.previous as { jarId: string; amount: string };
    const current = payload.current as { jarId: string; amount: string };

    await this.ledger.adjustJarBalance(tx, userId, current.jarId, new Prisma.Decimal(current.amount));
    await this.ledger.adjustJarBalance(tx, userId, previous.jarId, new Prisma.Decimal(previous.amount).negated());

    await tx.expense.update({
      where: { id: expenseId },
      data: { jarId: previous.jarId, amount: new Prisma.Decimal(previous.amount) },
    });
  }

  private async undoExpenseDelete(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const expenseId = payload.expenseId as string;
    const jarId = payload.jarId as string;
    const amount = new Prisma.Decimal(payload.amount as string);
    const dayId = payload.dayId as string;
    const description = payload.description as string;

    await tx.expense.create({
      data: { id: expenseId, dayId, jarId, amount, description, order: 0 },
    });
    await this.ledger.adjustJarBalance(tx, userId, jarId, amount.negated());
  }

  private async undoTransferCreate(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const transferId = payload.transferId as string;
    const fromJarId = payload.fromJarId as string;
    const toJarId = payload.toJarId as string;
    const amount = new Prisma.Decimal(payload.amount as string);

    await this.ledger.adjustJarBalance(tx, userId, fromJarId, amount);
    await this.ledger.adjustJarBalance(tx, userId, toJarId, amount.negated());
    await tx.transfer.delete({ where: { id: transferId } });
  }

  private async undoDebtCreate(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const debtId = payload.debtId as string;
    const type = payload.type as DebtType;
    const allocations = payload.allocations as JarAmountEntry[];

    if (type === DebtType.OWED_TO_ME) {
      for (const a of allocations) {
        await this.ledger.adjustJarBalance(tx, userId, a.jarId, new Prisma.Decimal(a.amount));
      }
    }
    await tx.debt.delete({ where: { id: debtId } });
  }

  private async undoDebtCreateBulk(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const debtIds = payload.debtIds as string[];
    const allocations = payload.allocations as JarAmountEntry[];

    for (const a of allocations) {
      await this.ledger.adjustJarBalance(tx, userId, a.jarId, new Prisma.Decimal(a.amount));
    }
    await tx.debt.deleteMany({ where: { id: { in: debtIds } } });
  }

  private async undoDebtRepayment(tx: Tx, userId: string, payload: Record<string, unknown>) {
    const debtId = payload.debtId as string;
    const repaymentId = payload.repaymentId as string;
    const type = payload.type as DebtType | undefined;
    const allocations = payload.allocations as JarAmountEntry[] | undefined;

    if (allocations && type) {
      for (const a of allocations) {
        const delta = type === DebtType.OWED_TO_ME ? new Prisma.Decimal(a.amount).negated() : new Prisma.Decimal(a.amount);
        await this.ledger.adjustJarBalance(tx, userId, a.jarId, delta);
      }
    }

    await tx.debtRepayment.delete({ where: { id: repaymentId } });

    const remaining = await tx.debtRepayment.findMany({ where: { debtId, forgiven: false } });
    const repaidSoFar = remaining.reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
    const status = repaidSoFar.isZero() ? DebtStatus.ACTIVE : DebtStatus.PARTIALLY_REPAID;
    await tx.debt.update({ where: { id: debtId }, data: { status } });
  }
}
