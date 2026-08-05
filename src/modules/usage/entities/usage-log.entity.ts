import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
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

  @Column({ nullable: true })
  apiKeyId?: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
