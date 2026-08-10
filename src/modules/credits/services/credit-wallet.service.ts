import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CreditWallet } from '../entities/credit-wallet.entity';
import { CreateCreditWalletDto } from '../dto/credit-wallet.dto';

@Injectable()
export class CreditWalletService {
  constructor(
    @InjectRepository(CreditWallet)
    private readonly walletRepo: Repository<CreditWallet>,
  ) { }

  async create(
    createWalletDto: CreateCreditWalletDto,
    manager?: EntityManager,
  ): Promise<CreditWallet> {
    const { userId, initialBalance } = createWalletDto;

    const repo = manager
      ? manager.getRepository(CreditWallet)
      : this.walletRepo;
    const wallet = repo.create({ userId, balance: initialBalance });
    return repo.save(wallet);
  }

  async findWalletByUserId(
    userId: string,
    manager?: EntityManager,
  ): Promise<CreditWallet | null> {
    const repo = manager
      ? manager.getRepository(CreditWallet)
      : this.walletRepo;
    return repo.findOne({ where: { userId } });
  }

  // balance can be negative
  async updateBalance(
    userId: string,
    balance: number,
    manager?: EntityManager,
  ): Promise<CreditWallet> {
    const repo = manager
      ? manager.getRepository(CreditWallet)
      : this.walletRepo;
    const result = await repo.query(
      `UPDATE credit_wallets SET balance = balance + $1 WHERE "userId" = $2 RETURNING *`,
      [balance, userId],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    if (!rows || rows.length === 0) {
      throw new BadRequestException('Wallet not found');
    }
    return repo.create(rows[0] as Partial<CreditWallet>);
  }

  async softDelete(
    wallet: CreditWallet,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(CreditWallet)
      : this.walletRepo;
    await repo.softRemove(wallet);
  }

  // balance can not be -ve
  async decrementWithCheck(
    userId: string,
    amount: number,
    manager?: EntityManager,
  ): Promise<CreditWallet> {
    const repo = manager
      ? manager.getRepository(CreditWallet)
      : this.walletRepo;

    const result = await repo.query(
      `
      UPDATE credit_wallets 
      SET balance = balance - $1 
      WHERE "userId" = $2 AND balance >= $1 
      RETURNING *
    `,
      [amount, userId],
    );

    if (
      !result ||
      result.length === 0 ||
      !result[0] ||
      result[0].length === 0
    ) {
      throw new BadRequestException('Insufficient credits or wallet not found');
    }

    const rows = Array.isArray(result[0]) ? result[0] : result;
    if (rows.length === 0) {
      throw new BadRequestException('Insufficient credits or wallet not found');
    }

    return repo.create(rows[0] as Partial<CreditWallet>);
  }
}
