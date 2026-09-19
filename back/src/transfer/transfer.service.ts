import { BadRequestException, Injectable } from '@nestjs/common';
import { JarType, Prisma } from '@prisma/client';
import { DebtService } from '../debt/debt.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly debtService: DebtService,
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

      const fromJar = jars.find((j) => j.id === dto.fromJarId);
      const toJar = jars.find((j) => j.id === dto.toJarId);
      if (!fromJar || !toJar) {
        throw new BadRequestException('Both jars must belong to the user and be active');
      }

      if (dto.asLoan) {
        if (fromJar.type !== JarType.SAVINGS) {
          throw new BadRequestException('Only transfers out of a savings jar can be recorded as a debt');
        }
        if (toJar.type === JarType.SAVINGS) {
          throw new BadRequestException('Cannot record a transfer into another savings jar as a debt');
        }
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

      if (dto.asLoan) {
        await this.debtService.createSelfDebt(tx, userId, {
          amount,
          sourceJarId: dto.fromJarId,
          description: dto.description || `«${fromJar.name}» → «${toJar.name}»`,
        });
      }

      return transfer;
    });
  }
}
