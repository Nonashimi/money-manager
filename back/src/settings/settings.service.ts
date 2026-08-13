import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.settings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const { markTourSeen, resetTours, ...rest } = dto;

    let seenTours: string[] | undefined;
    if (resetTours) {
      seenTours = [];
    } else if (markTourSeen) {
      const existing = await this.prisma.settings.findUnique({ where: { userId }, select: { seenTours: true } });
      const current = existing?.seenTours ?? [];
      seenTours = current.includes(markTourSeen) ? current : [...current, markTourSeen];
    }

    return this.prisma.settings.upsert({
      where: { userId },
      create: { userId, ...rest, ...(seenTours ? { seenTours } : {}) },
      update: { ...rest, ...(seenTours ? { seenTours } : {}) },
    });
  }
}
