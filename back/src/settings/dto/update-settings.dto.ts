import { IsBoolean, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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

  /** Marks a single product-tour id as seen (e.g. "dashboard", "jars") — appended to Settings.seenTours. */
  @IsOptional()
  @IsString()
  markTourSeen?: string;

  /** Clears Settings.seenTours entirely so every page tour runs again — used by the "show guide" setting. */
  @IsOptional()
  @IsBoolean()
  resetTours?: boolean;
}
