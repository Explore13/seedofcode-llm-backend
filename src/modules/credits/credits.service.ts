import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreditWallet } from './entities/credit-wallet.entity';
import {
  CreditTransaction,
  CreditTransactionReason,
} from './entities/credit-transaction.entity';
import { UserService } from '../user/user.service';
import { CreditWalletService } from './services/credit-wallet.service';
import { CreditTransactionService } from './services/credit-transaction.service';
import { UsageLog } from '../usage/entities/usage-log.entity';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly walletService: CreditWalletService,
    private readonly transactionService: CreditTransactionService,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) { }

  async reserveCredits(
    userId: string,
    estimatedCost: number,
  ): Promise<{
    transactionId: string;
    reservedAmount: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let wallet: Partial<CreditWallet>;
      try {
        wallet = await this.walletService.decrementWithCheck(
          userId,
          estimatedCost,
          queryRunner.manager,
        );
      } catch (e) {
        if (e instanceof BadRequestException) {
          throw new HttpException(
            'INSUFFICIENT_CREDITS',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        throw e;
      }

      const transaction = await this.transactionService.create(
        {
          userId,
          amount: -estimatedCost,
          reason: CreditTransactionReason.RESERVATION,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return {
        transactionId: transaction.id,
        reservedAmount: estimatedCost,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async settleReservation(
    userId: string,
    reservationTransactionId: string,
    reservedAmount: number,
    actualCost: number,
    usageLogData: Partial<UsageLog>,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transactionRepo = queryRunner.manager.getRepository(
        CreditTransaction,
      );
      const reservationTx = await transactionRepo.findOne({
        where: { id: reservationTransactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !reservationTx ||
        reservationTx.reason !== CreditTransactionReason.RESERVATION
      ) {
        await queryRunner.commitTransaction();
        return; // Already settled or not found
      }

      const usageRepo = queryRunner.manager.getRepository(UsageLog);
      usageLogData.creditsCost = actualCost;
      const usageLog = usageRepo.create(usageLogData);
      await usageRepo.save(usageLog);

      const delta = reservedAmount - actualCost;
      if (delta !== 0) {
        await this.walletService.updateBalance(
          userId,
          delta,
          queryRunner.manager,
        );
        await this.transactionService.create(
          {
            userId,
            amount: delta,
            reason:
              delta > 0
                ? CreditTransactionReason.REFUND
                : CreditTransactionReason.SHORTFALL,
            usageLogId: usageLog.id,
          },
          queryRunner.manager,
        );
      }

      await this.transactionService.update(
        reservationTransactionId,
        {
          reason: CreditTransactionReason.CHAT_COMPLETION,
          usageLogId: usageLog.id,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to settle reservation ${reservationTransactionId} for user ${userId}`,
        err,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Wallet - Create, Update, Get, Delete and Sync Wallet Balance
  async createWallet(userId: string): Promise<CreditWallet> {
    const existingWallet = await this.walletService.findWalletByUserId(userId);
    if (existingWallet) {
      throw new BadRequestException('Wallet already exists for this user');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedWallet = await this.walletService.create(
        { userId, initialBalance: 1000 },
        queryRunner.manager,
      );
      await this.transactionService.create(
        { userId, amount: 1000, reason: CreditTransactionReason.SIGNUP_BONUS },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Created wallet for user ${userId} with 1000 credits signup bonus`,
      );
      return savedWallet;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create wallet for user ${userId}`, err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getWallet(userId: string): Promise<CreditWallet> {
    const wallet = await this.walletService.findWalletByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  async updateWalletBalance(
    userId: string,
    amount: number,
    reason: CreditTransactionReason = CreditTransactionReason.TOPUP,
  ): Promise<CreditWallet> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await this.walletService.findWalletByUserId(
        userId,
        queryRunner.manager,
      );
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const updatedWallet = await this.walletService.updateBalance(
        userId,
        amount,
        queryRunner.manager,
      );
      await this.transactionService.create(
        { userId, amount, reason },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return updatedWallet;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteWallet(userId: string): Promise<void> {
    const wallet = await this.getWallet(userId);
    await this.walletService.softDelete(wallet);
  }

  async checkAndCreateWallet(
    userId: string,
  ): Promise<{ created: boolean; wallet: CreditWallet }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.verified) {
      throw new BadRequestException('Cannot create wallet for unverified user');
    }

    let wallet = await this.walletService.findWalletByUserId(userId);
    let created = false;

    if (!wallet) {
      try {
        wallet = await this.createWallet(userId);
        created = true;
      } catch (e) {
        // Lost a create race (unique constraint / "already exists") — another
        // concurrent sync created it first. Fall back to the existing row.
        wallet = await this.walletService.findWalletByUserId(userId);
        if (!wallet) {
          throw e;
        }
      }
    }

    // Reconcile the cached balance against the ledger (source of truth)
    const ledgerSum = await this.transactionService.sumByUserId(userId);

    const difference = ledgerSum - wallet.balance;


    if (difference !== 0) {
      wallet = await this.walletService.updateBalance(userId, difference);
    }

    return { created, wallet };
  }
}
