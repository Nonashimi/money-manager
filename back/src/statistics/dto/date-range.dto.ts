import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DateRangeDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /**
   * Lookback window in days (e.g. 7 for "week", 30 for "month"), used only when `from` is not
   * given. Still clamped to the user's first-ever expense — see resolveRange — so a preset like
   * "week" never dilutes the average with days before any history existed.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  /**
   * Starts the range at the first-ever expense, uncapped by `days` — for the lifetime average.
   * Transformed explicitly (not `@Type(() => Boolean)`) since `Boolean('false')` is `true` in JS
   * — a real footgun for a query string where every value arrives as text.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  allTime?: boolean;
}
