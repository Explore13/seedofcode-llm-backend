import { UsageLog } from 'src/modules/usage/entities/usage-log.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum CreditTransactionReason {
  CHAT_COMPLETION = 'chat_completion',
  RESERVATION = 'reservation',
  SHORTFALL = 'shortfall',
  REFUND = 'refund',
  TOPUP = 'topup',
  SIGNUP_BONUS = 'signup_bonus',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: CreditTransactionReason })
  reason: CreditTransactionReason;

  @Column({ nullable: true })
  usageLogId?: string;

  @ManyToOne(() => UsageLog, (usageLog) => usageLog.creditTransactions)
  @JoinColumn()
  usageLog?: UsageLog;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
