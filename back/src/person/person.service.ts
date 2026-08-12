import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.person.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  async findOneOrThrow(userId: string, id: string) {
    const person = await this.prisma.person.findFirst({ where: { id, userId } });
    if (!person) {
      throw new NotFoundException('Person not found');
    }
    return person;
  }

  create(userId: string, dto: CreatePersonDto) {
    return this.prisma.person.create({ data: { userId, ...dto } });
  }

  async update(userId: string, id: string, dto: UpdatePersonDto) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.person.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOneOrThrow(userId, id);
    await this.prisma.person.delete({ where: { id } });
    return { id };
  }
}
