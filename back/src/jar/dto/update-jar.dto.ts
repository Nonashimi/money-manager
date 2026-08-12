import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateJarDto } from './create-jar.dto';

export class UpdateJarDto extends PartialType(CreateJarDto) {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
