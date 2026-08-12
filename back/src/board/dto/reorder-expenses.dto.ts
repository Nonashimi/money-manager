import { IsArray, IsString } from 'class-validator';

export class ReorderExpensesDto {
  @IsString()
  dayId: string;

  @IsString()
  jarId: string;

  @IsArray()
  @IsString({ each: true })
  expenseIds: string[];
}
