import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsString,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { UsageStatus } from '../entities/usage-log.entity';
import { Type } from 'class-transformer';

export class GetUsageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class AdminGetUsageQueryDto extends GetUsageQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class CreateUsageLogDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  apiKeyId?: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsInt()
  @Min(0)
  promptTokens: number;

  @IsInt()
  @Min(0)
  completionTokens: number;

  @IsInt()
  @Min(0)
  latencyMs: number;

  @IsEnum(UsageStatus)
  status: UsageStatus;

  @IsInt()
  @Min(0)
  creditsCost: number;
}

export class UpdateUsageLogDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  promptTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completionTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  latencyMs?: number;

  @IsOptional()
  @IsEnum(UsageStatus)
  status?: UsageStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  creditsCost?: number;
}
