import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateExpenseDto {
  @IsDateString()
  date: string;

  @IsString()
  jarId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
