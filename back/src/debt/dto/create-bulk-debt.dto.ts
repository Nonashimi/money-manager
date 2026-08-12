import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

class BulkDebtPersonEntry {
  @IsString()
  personId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

class BulkDebtAllocationEntry {
  @IsString()
  jarId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CreateBulkDebtDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkDebtPersonEntry)
  entries: BulkDebtPersonEntry[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkDebtAllocationEntry)
  allocations: BulkDebtAllocationEntry[];
}
