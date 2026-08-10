import { CreditTransaction } from 'src/modules/credits/entities/credit-transaction.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';

export enum UsageStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

@Entity('usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  apiKeyId?: string | null;

  @Column()
  model: string;

  @Column({ type: 'int' })
  promptTokens: number;

  @Column({ type: 'int' })
  completionTokens: number;

  @Column({ type: 'int' })
  latencyMs: number;

  @Column({ type: 'enum', enum: UsageStatus })
  status: UsageStatus;

  @Column({ type: 'int' })
  creditsCost: number;

  @OneToMany(() => CreditTransaction, (transaction) => transaction.usageLog)
  creditTransactions: CreditTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
