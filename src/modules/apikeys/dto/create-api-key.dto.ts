import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateApiKeyDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'API Key name cannot be empty' })
  @MaxLength(100, { message: 'API Key name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsIn(['live', 'test'])
  mode?: 'live' | 'test';
}
