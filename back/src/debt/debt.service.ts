import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtStatus, DebtType, JarType, Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBulkDebtDto } from './dto/create-bulk-debt.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RepayDebtDto } from './dto/repay-debt.dto';

const EPSILON = new Prisma.Decimal('0.01');

function formatAmount(value: Prisma.Decimal.Value): string {
  return Number(value.toString()).toLocaleString('ru-RU');
}

@Injectable()
export class DebtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  findAll(userId: string, type?: DebtType) {
    return this.prisma.debt.findMany({
      where: { userId, ...(type ? { type } : {}) },
      include: { person: true, allocations: true, repayments: { include: { allocations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateDebtDto) {
    const amount = new Prisma.Decimal(dto.amount);
    const allocationsTotal = dto.allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
    if (allocationsTotal.minus(amount).abs().greaterThan(EPSILON)) {
      throw new BadRequestException('Allocations must sum to the debt amount');
    }

    return this.ledger.transaction(async (tx) => {
      const person = await tx.person.findFirst({ where: { id: dto.personId, userId } });
      if (!person) {
        throw new BadRequestException('Person not found');
      }

      const jarIds = dto.allocations.map((a) => a.jarId);
      const jars = await tx.jar.findMany({
        where: { userId, id: { in: jarIds }, archived: false, type: JarType.SPENDING },
      });
      if (jars.length !== new Set(jarIds).size) {
        throw new BadRequestException(
          'Some jars do not belong to the user, are archived, or are savings jars (not allowed for debts)',
        );
      }

      const debt = await tx.debt.create({
        data: {
          userId,
          personId: dto.personId,
          type: dto.type,
          amount,
          description: dto.description,
          allocations: {
            create: dto.allocations.map((a) => ({ jarId: a.jarId, amount: new Prisma.Decimal(a.amount) })),
          },
        },
        include: { allocations: true, person: true },
      });

      if (dto.type === DebtType.OWED_TO_ME) {
        for (const a of dto.allocations) {
          await this.ledger.adjustJarBalance(tx, userId, a.jarId, new Prisma.Decimal(a.amount).negated());
        }
      }

      const breakdown = this.formatAllocations(jars, dto.allocations);
      const summary =
        dto.type === DebtType.OWED_TO_ME
          ? `Дали в долг ${formatAmount(amount)} (${person.name}) — списано из: ${breakdown}`
          : `Взяли в долг ${formatAmount(amount)} (${person.name}) — план погашения из: ${breakdown}`;
      await this.ledger.logAction(tx, userId, 'DEBT_CREATE', summary, {
        debtId: debt.id,
        type: dto.type,
        allocations: dto.allocations.map((a) => ({ jarId: a.jarId, amount: a.amount })),
      });

      return debt;
    });
  }

  /**
   * Creates one OWED_TO_ME debt per person in `entries`, all funded from the same combined
   * jar allocation (e.g. you paid a bill and split the reimbursement across several friends).
   * Each jar is debited once for its total share; every individual debt's own `DebtAllocation`
   * is that person's proportional slice of the same jar weights, so each debt can still be
   * repaid/forgiven independently later.
   */
  async createBulk(userId: string, dto: CreateBulkDebtDto) {
    const entriesTotal = dto.entries.reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));
    const allocationsTotal = dto.allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
    if (allocationsTotal.minus(entriesTotal).abs().greaterThan(EPSILON)) {
      throw new BadRequestException('Allocations must sum to the total of all entries');
    }

    return this.ledger.transaction(async (tx) => {
      const personIds = dto.entries.map((e) => e.personId);
      const persons = await tx.person.findMany({ where: { userId, id: { in: personIds } } });
      if (persons.length !== new Set(personIds).size) {
        throw new BadRequestException('Some contacts do not belong to the user');
      }
      const personById = new Map(persons.map((p) => [p.id, p]));

      const jarIds = dto.allocations.map((a) => a.jarId);
      const jars = await tx.jar.findMany({
        where: { userId, id: { in: jarIds }, archived: false, type: JarType.SPENDING },
      });
      if (jars.length !== new Set(jarIds).size) {
        throw new BadRequestException(
          'Some jars do not belong to the user, are archived, or are savings jars (not allowed for debts)',
        );
      }

      for (const a of dto.allocations) {
        await this.ledger.adjustJarBalance(tx, userId, a.jarId, new Prisma.Decimal(a.amount).negated());
      }

      const jarWeights = dto.allocations.map((a) => ({ jarId: a.jarId, amount: new Prisma.Decimal(a.amount) }));

      const debts: Awaited<ReturnType<typeof tx.debt.create>>[] = [];
      for (const entry of dto.entries) {
        const amount = new Prisma.Decimal(entry.amount);
        const personAllocations = this.proportionalSplit(amount, jarWeights);

        const debt = await tx.debt.create({
          data: {
            userId,
            personId: entry.personId,
            type: DebtType.OWED_TO_ME,
            amount,
            description: dto.description,
            allocations: { create: personAllocations.map((a) => ({ jarId: a.jarId, amount: a.amount })) },
          },
          include: { allocations: true, person: true },
        });
        debts.push(debt);
      }

      const breakdown = this.formatAllocations(jars, dto.allocations);
      const names = dto.entries.map((e) => personById.get(e.personId)!.name).join(', ');
      const summary = `Дали в долг ${formatAmount(entriesTotal)} нескольким (${names}) — списано из: ${breakdown}`;

      await this.ledger.logAction(tx, userId, 'DEBT_CREATE_BULK', summary, {
        debtIds: debts.map((d) => d.id),
        allocations: dto.allocations.map((a) => ({ jarId: a.jarId, amount: a.amount })),
      });

      return debts;
    });
  }

  async repay(userId: string, debtId: string, dto: RepayDebtDto) {
    return this.ledger.transaction(async (tx) => {
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
        include: { allocations: true, repayments: true, person: true },
      });
      if (!debt) {
        throw new NotFoundException('Debt not found');
      }
      if (debt.userId !== userId) {
        throw new ForbiddenException();
      }
      if (debt.status === DebtStatus.REPAID || debt.status === DebtStatus.FORGIVEN) {
        throw new BadRequestException('Debt is already closed');
      }

      const repaidSoFar = debt.repayments
        .filter((r) => !r.forgiven)
        .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
      const remaining = debt.amount.minus(repaidSoFar);

      if (dto.forgiven) {
        const repayment = await tx.debtRepayment.create({
          data: { debtId, amount: remaining, forgiven: true },
        });
        await tx.debt.update({ where: { id: debtId }, data: { status: DebtStatus.FORGIVEN } });
        await this.ledger.logAction(tx, userId, 'DEBT_FORGIVE', `Долг прощён (${debt.person.name})`, {
          debtId,
          repaymentId: repayment.id,
        });
        return tx.debt.findUniqueOrThrow({
          where: { id: debtId },
          include: { allocations: true, repayments: { include: { allocations: true } }, person: true },
        });
      }

      const amount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : remaining;
      if (amount.lessThanOrEqualTo(0) || amount.minus(remaining).greaterThan(EPSILON)) {
        throw new BadRequestException('Repayment amount must be between 0 and the remaining debt amount');
      }

      const allocations = dto.allocations
        ? dto.allocations.map((a) => ({ jarId: a.jarId, amount: new Prisma.Decimal(a.amount) }))
        : this.proportionalSplit(amount, debt.allocations);

      const allocationsTotal = allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
      if (allocationsTotal.minus(amount).abs().greaterThan(EPSILON)) {
        throw new BadRequestException('Repayment allocations must sum to the repayment amount');
      }

      const jarIds = allocations.map((a) => a.jarId);
      const jars = await tx.jar.findMany({
        where: { userId, id: { in: jarIds }, archived: false, type: JarType.SPENDING },
      });
      if (jars.length !== new Set(jarIds).size) {
        throw new BadRequestException(
          'Some jars do not belong to the user, are archived, or are savings jars (not allowed for debts)',
        );
      }

      for (const a of allocations) {
        const delta = debt.type === DebtType.OWED_TO_ME ? a.amount : a.amount.negated();
        await this.ledger.adjustJarBalance(tx, userId, a.jarId, delta);
      }

      const repayment = await tx.debtRepayment.create({
        data: {
          debtId,
          amount,
          allocations: { create: allocations.map((a) => ({ jarId: a.jarId, amount: a.amount })) },
        },
      });

      const newRepaidTotal = repaidSoFar.plus(amount);
      const status = newRepaidTotal.greaterThanOrEqualTo(debt.amount) ? DebtStatus.REPAID : DebtStatus.PARTIALLY_REPAID;
      await tx.debt.update({ where: { id: debtId }, data: { status } });

      const breakdown = this.formatAllocations(jars, allocations);
      const summary =
        debt.type === DebtType.OWED_TO_ME
          ? `Возврат долга ${formatAmount(amount)} (${debt.person.name}) — зачислено в: ${breakdown}`
          : `Погашение долга ${formatAmount(amount)} (${debt.person.name}) — списано из: ${breakdown}`;
      await this.ledger.logAction(tx, userId, 'DEBT_REPAY', summary, {
        debtId,
        repaymentId: repayment.id,
        type: debt.type,
        amount: amount.toString(),
        allocations: allocations.map((a) => ({ jarId: a.jarId, amount: a.amount.toString() })),
      });

      return tx.debt.findUniqueOrThrow({
        where: { id: debtId },
        include: { allocations: true, repayments: { include: { allocations: true } }, person: true },
      });
    });
  }

  /** Renders "«Нужды» 2 000, «Развлечения» 1 000" for a history summary. */
  private formatAllocations(
    jars: { id: string; name: string }[],
    allocations: { jarId: string; amount: Prisma.Decimal.Value }[],
  ): string {
    const nameById = new Map(jars.map((j) => [j.id, j.name]));
    return allocations.map((a) => `«${nameById.get(a.jarId) ?? '?'}» ${formatAmount(a.amount)}`).join(', ');
  }

  /** Splits `amount` proportionally to each allocation's original share, remainder goes to the last entry. */
  private proportionalSplit(
    amount: Prisma.Decimal,
    originalAllocations: { jarId: string; amount: Prisma.Decimal }[],
  ) {
    const total = originalAllocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
    const result: { jarId: string; amount: Prisma.Decimal }[] = [];
    let allocated = new Prisma.Decimal(0);

    originalAllocations.forEach((entry, index) => {
      const isLast = index === originalAllocations.length - 1;
      const raw = total.isZero() ? new Prisma.Decimal(0) : amount.times(entry.amount).dividedBy(total).toDecimalPlaces(2);
      const share = isLast ? amount.minus(allocated) : raw;
      allocated = allocated.plus(share);
      result.push({ jarId: entry.jarId, amount: share });
    });

    return result;
  }
}
