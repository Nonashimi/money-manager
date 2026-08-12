import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';

class JarPercentEntry {
  @IsString()
  jarId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;
}

export class ReallocateJarsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => JarPercentEntry)
  allocations: JarPercentEntry[];
}
