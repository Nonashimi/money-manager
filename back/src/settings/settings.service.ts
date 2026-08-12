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

  update(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.settings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
