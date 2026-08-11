import { IsInt, IsNotEmpty } from 'class-validator';

export class UpdateWalletBalanceDto {
  @IsNotEmpty({ message: 'The adjustment amount cannot be empty.' })
  @IsInt({ message: 'The adjustment amount must be a whole number (integer).' })
  amount: number;
}
