import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateModelDto {
  @IsOptional()
  @IsBoolean({ message: 'enabled must be a boolean' })
  enabled?: boolean;

  @IsOptional()
  @IsInt({ message: 'creditsPerInputToken must be an integer' })
  @Min(0, { message: 'creditsPerInputToken cannot be negative' })
  creditsPerInputToken?: number;

  @IsOptional()
  @IsInt({ message: 'creditsPerOutputToken must be an integer' })
  @Min(0, { message: 'creditsPerOutputToken cannot be negative' })
  creditsPerOutputToken?: number;
}
