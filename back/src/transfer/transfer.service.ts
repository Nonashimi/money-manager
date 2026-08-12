import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  findAll(userId: string) {
    return this.prisma.transfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateTransferDto) {
    if (dto.fromJarId === dto.toJarId) {
      throw new BadRequestException('Source and destination jars must differ');
    }
    const amount = new Prisma.Decimal(dto.amount);

    return this.ledger.transaction(async (tx) => {
      const jars = await tx.jar.findMany({
        where: { userId, id: { in: [dto.fromJarId, dto.toJarId] }, archived: false },
      });
      if (jars.length !== 2) {
        throw new BadRequestException('Both jars must belong to the user and be active');
      }

      await this.ledger.adjustJarBalance(tx, userId, dto.fromJarId, amount.negated());
      await this.ledger.adjustJarBalance(tx, userId, dto.toJarId, amount);

      const transfer = await tx.transfer.create({
        data: { userId, fromJarId: dto.fromJarId, toJarId: dto.toJarId, amount, description: dto.description },
      });

      await this.ledger.logAction(tx, userId, 'TRANSFER_CREATE', `Перелив ${amount.toString()} между копилками`, {
        transferId: transfer.id,
        fromJarId: dto.fromJarId,
        toJarId: dto.toJarId,
        amount: amount.toString(),
      });

      return transfer;
    });
  }
}
