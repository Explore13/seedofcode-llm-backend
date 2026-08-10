import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateCreditWalletDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsInt({ message: 'Initial balance must be an integer' })
  @Min(0, { message: 'Initial balance cannot be negative' })
  initialBalance: number;
}
