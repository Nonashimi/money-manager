import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.person.findMany({ where: { userId, isSystem: false }, orderBy: { name: 'asc' } });
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
    const person = await this.findOneOrThrow(userId, id);
    if (person.isSystem) {
      throw new BadRequestException('Cannot modify a system contact');
    }
    return this.prisma.person.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const person = await this.findOneOrThrow(userId, id);
    if (person.isSystem) {
      throw new BadRequestException('Cannot delete a system contact');
    }
    await this.prisma.person.delete({ where: { id } });
    return { id };
  }
}
