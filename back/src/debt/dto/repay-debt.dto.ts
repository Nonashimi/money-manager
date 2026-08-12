import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

class RepaymentAllocationEntry {
  @IsString()
  jarId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class RepayDebtDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RepaymentAllocationEntry)
  allocations?: RepaymentAllocationEntry[];

  @IsOptional()
  @IsBoolean()
  forgiven?: boolean;
}
