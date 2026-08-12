import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  dailyNorm?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;
}
