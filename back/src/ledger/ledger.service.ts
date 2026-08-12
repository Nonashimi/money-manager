import { Injectable, NotFoundException } from '@nestjs/common';
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
