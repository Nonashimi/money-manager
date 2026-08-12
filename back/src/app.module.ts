import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BoardModule } from './board/board.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DebtModule } from './debt/debt.module';
import { HistoryModule } from './history/history.module';
import { IncomeModule } from './income/income.module';
import { JarModule } from './jar/jar.module';
import { LedgerModule } from './ledger/ledger.module';
import { PersonModule } from './person/person.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { StatisticsModule } from './statistics/statistics.module';
import { TransferModule } from './transfer/transfer.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LedgerModule,
    AuthModule,
    UserModule,
    JarModule,
    IncomeModule,
    BoardModule,
    TransferModule,
    PersonModule,
    DebtModule,
    HistoryModule,
    SettingsModule,
    StatisticsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
