import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  fromJarId: string;

  @IsString()
  toJarId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  /** Only valid when the source jar is type SAVINGS — records the transfer as a self-debt to that jar. */
  @IsOptional()
  @IsBoolean()
  asLoan?: boolean;
}
