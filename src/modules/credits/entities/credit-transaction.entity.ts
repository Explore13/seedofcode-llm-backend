import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum CreditTransactionReason {
  CHAT_COMPLETION = 'chat_completion',
  REFUND = 'refund',
  TOPUP = 'topup',
  SIGNUP_BONUS = 'signup_bonus',
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
