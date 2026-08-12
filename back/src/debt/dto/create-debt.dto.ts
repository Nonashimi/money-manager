import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DebtType } from '@prisma/client';

class DebtAllocationEntry {
  @IsString()
  jarId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CreateDebtDto {
  @IsString()
  personId: string;

  @IsEnum(DebtType)
  type: DebtType;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DebtAllocationEntry)
  allocations: DebtAllocationEntry[];
}
