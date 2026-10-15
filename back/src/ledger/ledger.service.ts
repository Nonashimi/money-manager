import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(tx));
  }

  async adjustJarBalance(tx: Tx, userId: string, jarId: string, delta: Prisma.Decimal.Value) {
    const jar = await tx.jar.findFirst({ where: { id: jarId, userId } });
    if (!jar) {
      throw new NotFoundException(`Jar ${jarId} not found`);
    }
    return tx.jar.update({
      where: { id: jarId },
      data: { balance: { increment: delta } },
    });
  }

  /**
   * Debits a jar for a new operation, refusing if the balance is too low. The check is part of
   * the UPDATE itself, so two concurrent debits cannot both pass. Undo paths deliberately keep
   * using adjustJarBalance: rolling an action back must never fail on balance.
   */
  async debitJar(tx: Tx, userId: string, jarId: string, amount: Prisma.Decimal.Value) {
    const value = new Prisma.Decimal(amount);
    const result = await tx.jar.updateMany({
      where: { id: jarId, userId, balance: { gte: value } },
      data: { balance: { decrement: value } },
    });
    if (result.count === 0) {
      const jar = await tx.jar.findFirst({ where: { id: jarId, userId } });
      if (!jar) {
        throw new NotFoundException(`Jar ${jarId} not found`);
      }
      throw new BadRequestException(
        `Insufficient funds in «${jar.name}»: available ${jar.balance.toString()}, required ${value.toString()}`,
      );
    }
  }

  logAction(
    tx: Tx,
    userId: string,
    type: string,
    summary: string,
    payload: Prisma.InputJsonValue,
  ) {
    return tx.historyAction.create({
      data: { userId, type, summary, payload },
    });
  }
}
