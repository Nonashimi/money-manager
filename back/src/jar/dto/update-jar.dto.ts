import { PartialType } from '@nestjs/mapped-types';
import { CreateJarDto } from './create-jar.dto';

// Archiving is deliberately not patchable: it must go through DELETE /jars/:id so that
// percentages are rebalanced (see JarService.archive).
export class UpdateJarDto extends PartialType(CreateJarDto) {}
