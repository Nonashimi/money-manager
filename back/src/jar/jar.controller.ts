import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateJarDto } from './dto/create-jar.dto';
import { ReallocateJarsDto } from './dto/reallocate-jars.dto';
import { ReorderJarsDto } from './dto/reorder-jars.dto';
import { UpdateJarDto } from './dto/update-jar.dto';
import { JarService } from './jar.service';

@Controller('jars')
export class JarController {
  constructor(private readonly jarService: JarService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('includeArchived') includeArchived?: string) {
    return this.jarService.findAll(user.userId, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJarDto) {
    return this.jarService.create(user.userId, dto);
  }

  @Patch('reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderJarsDto) {
    return this.jarService.reorder(user.userId, dto.jarIds);
  }

  @Patch('reallocate')
  reallocate(@CurrentUser() user: AuthUser, @Body() dto: ReallocateJarsDto) {
    return this.jarService.reallocate(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJarDto) {
    return this.jarService.update(user.userId, id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.jarService.archive(user.userId, id);
  }
}
