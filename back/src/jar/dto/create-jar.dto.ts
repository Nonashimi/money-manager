import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JarType } from '@prisma/client';

export class CreateJarDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsEnum(JarType)
  type?: JarType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultPercent?: number;

  @IsOptional()
  @IsInt()
  order?: number;
}
