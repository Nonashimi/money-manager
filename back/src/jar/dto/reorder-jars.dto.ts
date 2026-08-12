import { IsArray, IsString } from 'class-validator';

export class ReorderJarsDto {
  @IsArray()
  @IsString({ each: true })
  jarIds: string[];
}
