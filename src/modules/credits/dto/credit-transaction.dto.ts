import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { CreditTransactionReason } from '../entities/credit-transaction.entity';

export class CreateCreditTransactionDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsInt({ message: 'Amount must be a whole number (integer)' })
  @IsNotEmpty({ message: 'Transaction amount is required' })
  amount: number;

  @IsEnum(CreditTransactionReason, { message: 'Invalid transaction reason' })
  @IsNotEmpty({ message: 'Transaction reason is required' })
  reason: CreditTransactionReason;

  @IsOptional()
  @IsUUID(4, { message: 'Usage log ID must be a valid UUID' })
  usageLogId?: string;
}

export class UpdateCreditTransactionDto {
  @IsOptional()
  @IsInt({ message: 'Amount must be a whole number (integer)' })
  amount?: number;

  @IsOptional()
  @IsEnum(CreditTransactionReason, { message: 'Invalid transaction reason' })
  reason?: CreditTransactionReason;

  @IsOptional()
  @IsUUID(4, { message: 'Usage log ID must be a valid UUID' })
  usageLogId?: string;
}
