import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJarDto } from './dto/create-jar.dto';
import { ReallocateJarsDto } from './dto/reallocate-jars.dto';
import { UpdateJarDto } from './dto/update-jar.dto';

const HUNDRED = new Prisma.Decimal(100);
const ZERO = new Prisma.Decimal(0);

@Injectable()
export class JarService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, includeArchived = false) {
    return this.prisma.jar.findMany({
      where: { userId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: { order: 'asc' },
    });
  }

  async findOneOrThrow(userId: string, jarId: string) {
    const jar = await this.prisma.jar.findFirst({ where: { id: jarId, userId } });
    if (!jar) {
      throw new NotFoundException('Jar not found');
    }
    return jar;
  }

  async create(userId: string, dto: CreateJarDto) {
    return this.prisma.$transaction(async (tx) => {
      const activeJars = await tx.jar.findMany({ where: { userId, archived: false } });
      const isFirstJar = activeJars.length === 0;
      const requestedPercent = dto.defaultPercent ?? (isFirstJar ? 100 : 0);

      const maxOrder = await tx.jar.aggregate({ where: { userId }, _max: { order: true } });
      const order = dto.order ?? (maxOrder._max.order ?? -1) + 1;

      const jar = await tx.jar.create({
        data: { userId, name: dto.name, color: dto.color, type: dto.type, order, defaultPercent: 0 },
      });

      await this.rebalanceOthers(tx, userId, jar.id, new Prisma.Decimal(requestedPercent));

      return tx.jar.findUniqueOrThrow({ where: { id: jar.id } });
    });
  }

  async update(userId: string, jarId: string, dto: UpdateJarDto) {
    await this.findOneOrThrow(userId, jarId);

    return this.prisma.$transaction(async (tx) => {
      const { defaultPercent, ...rest } = dto;

      await tx.jar.update({ where: { id: jarId }, data: rest });

      if (defaultPercent !== undefined) {
        await this.rebalanceOthers(tx, userId, jarId, new Prisma.Decimal(defaultPercent));
      }

      return tx.jar.findUniqueOrThrow({ where: { id: jarId } });
    });
  }

  async archive(userId: string, jarId: string) {
    await this.findOneOrThrow(userId, jarId);
    return this.prisma.$transaction(async (tx) => {
      const jar = await tx.jar.update({ where: { id: jarId }, data: { archived: true } });
      await this.rebalanceOthers(tx, userId, jarId, ZERO, true);
      return jar;
    });
  }

  async reorder(userId: string, jarIds: string[]) {
    const jars = await this.prisma.jar.findMany({ where: { userId, id: { in: jarIds } } });
    if (jars.length !== jarIds.length) {
      throw new BadRequestException('Some jars do not belong to the user');
    }
    await this.prisma.$transaction(
      jarIds.map((id, index) => this.prisma.jar.update({ where: { id }, data: { order: index } })),
    );
    return this.findAll(userId, true);
  }

  async reallocate(userId: string, dto: ReallocateJarsDto) {
    const jarIds = dto.allocations.map((a) => a.jarId);

    const activeJars = await this.prisma.jar.findMany({ where: { userId, archived: false } });
    const activeIds = new Set(activeJars.map((j) => j.id));

    if (jarIds.length !== activeJars.length || !jarIds.every((id) => activeIds.has(id))) {
      throw new BadRequestException('Allocation must cover exactly all active jars');
    }

    const total = dto.allocations.reduce((sum, a) => sum + a.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException('Percentages must sum to 100');
    }

    await this.prisma.$transaction(
      dto.allocations.map((a) =>
        this.prisma.jar.update({ where: { id: a.jarId }, data: { defaultPercent: a.percent } }),
      ),
    );

    return this.findAll(userId);
  }

  /**
   * Sets `changedJarId`'s defaultPercent to `newPercent` and proportionally
   * shrinks/grows every other active jar so the total across active jars stays 100.
   */
  private async rebalanceOthers(
    tx: Prisma.TransactionClient,
    userId: string,
    changedJarId: string,
    newPercent: Prisma.Decimal,
    excludeChanged = false,
  ) {
    const others = await tx.jar.findMany({
      where: { userId, archived: false, id: { not: changedJarId } },
    });

    if (!excludeChanged) {
      await tx.jar.update({ where: { id: changedJarId }, data: { defaultPercent: newPercent } });
    }

    if (others.length === 0) {
      return;
    }

    let remaining = HUNDRED.minus(excludeChanged ? ZERO : newPercent);
    if (remaining.lessThan(ZERO)) remaining = ZERO;
    if (remaining.greaterThan(HUNDRED)) remaining = HUNDRED;

    const othersSum = others.reduce((sum, j) => sum.plus(j.defaultPercent), ZERO);

    const updates = others.map((jar) => {
      const share = othersSum.isZero()
        ? remaining.dividedBy(others.length)
        : jar.defaultPercent.dividedBy(othersSum).times(remaining);
      return tx.jar.update({ where: { id: jar.id }, data: { defaultPercent: share } });
    });

    await Promise.all(updates);
  }
}
