import { IsString, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'API Key name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
