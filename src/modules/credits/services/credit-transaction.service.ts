import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CreditTransaction } from '../entities/credit-transaction.entity';
import {
  CreateCreditTransactionDto,
  UpdateCreditTransactionDto,
} from '../dto/credit-transaction.dto';

@Injectable()
export class CreditTransactionService {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly transactionRepo: Repository<CreditTransaction>,
  ) { }

  async create(
    createDto: CreateCreditTransactionDto,
    manager?: EntityManager,
  ): Promise<CreditTransaction> {
    const { userId, amount, reason, usageLogId } = createDto;

    const repo = manager
      ? manager.getRepository(CreditTransaction)
      : this.transactionRepo;
    const transaction = repo.create({ userId, amount, reason, usageLogId });
    return repo.save(transaction);
  }

  async findByUserId(
    userId: string,
    manager?: EntityManager,
  ): Promise<CreditTransaction[]> {
    const repo = manager
      ? manager.getRepository(CreditTransaction)
      : this.transactionRepo;
    return repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateDto: UpdateCreditTransactionDto,
    manager?: EntityManager,
  ): Promise<CreditTransaction> {
    const repo = manager
      ? manager.getRepository(CreditTransaction)
      : this.transactionRepo;

    const transaction = await repo.findOne({ where: { id: id as any } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    Object.assign(transaction, updateDto);
    return repo.save(transaction);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    const repo = manager
      ? manager.getRepository(CreditTransaction)
      : this.transactionRepo;

    const transaction = await repo.findOne({ where: { id: id as any } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await repo.softRemove(transaction);
  }


  /**
 * Sum of all (non-deleted) transaction amounts for a user — the ledger is the
 * source of truth; wallet.balance is a cached copy of this value.
 */
  async sumByUserId(userId: string, manager?: EntityManager): Promise<number> {
    const repo = manager
      ? manager.getRepository(CreditTransaction)
      : this.transactionRepo;
    const result = await repo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'sum')
      .where('t.userId = :userId', { userId })
      .getRawOne<{ sum: string }>();
    return parseInt(result?.sum ?? '0', 10);
  }
}
