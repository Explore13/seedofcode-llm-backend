import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { CreditWallet } from './entities/credit-wallet.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { CreditWalletService } from './services/credit-wallet.service';
import { CreditTransactionService } from './services/credit-transaction.service';

import { UsageModule } from '../usage/usage.module';


@Module({
  imports: [TypeOrmModule.forFeature([CreditWallet, CreditTransaction]), UserModule, UsageModule],
  controllers: [CreditsController],
  providers: [CreditsService, CreditWalletService, CreditTransactionService],
  exports: [CreditsService, CreditWalletService, CreditTransactionService],
})
export class CreditsModule { }
