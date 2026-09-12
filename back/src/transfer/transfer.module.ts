import { Module } from '@nestjs/common';
import { DebtModule } from '../debt/debt.module';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';

@Module({
  imports: [DebtModule],
  controllers: [TransferController],
  providers: [TransferService],
})
export class TransferModule {}
