import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditWallet } from './entities/credit-wallet.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditWallet, CreditTransaction])],
  controllers: [],
  providers: [],
})
export class CreditsModule {}
