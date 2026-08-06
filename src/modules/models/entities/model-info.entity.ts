import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum ModelProvider {
  OLLAMA = 'ollama',
}

@Entity('models')
export class ModelInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // "llama3.1:8b" — Ollama's tag, the lookup key everywhere

  @Column({ type: 'enum', enum: ModelProvider, default: ModelProvider.OLLAMA })
  provider: ModelProvider;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', nullable: true })
  maxContext: number; // from model_info's dynamic "*.context_length" key

  @Column({ type: 'jsonb', default: [] })
  capabilities: string[]; // straight from Ollama: ["completion","vision","tools",...]

  @Column({ nullable: true })
  family: string;

  @Column({ nullable: true })
  parameterSize: string; // "8.0B" — display string

  @Column({ type: 'bigint', nullable: true })
  parameterCount: string; // "7996157674" — precise, sortable

  @Column({ nullable: true })
  quantizationLevel: string;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes: string;

  @Column({ nullable: true })
  digest: string;

  @Column({ type: 'int', default: 0 })
  creditsPerInputToken: number; // per 1000 tokens, per earlier pricing discussion

  @Column({ type: 'int', default: 0 })
  creditsPerOutputToken: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
