import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
// import { IsValidModel } from '../validators/is-valid-model.validator';

export class ChatMessage {
  @IsString({ message: 'Role must be a string' })
  @IsIn(['system', 'user', 'assistant'], { message: 'Role must be one of: system, user, assistant' })
  role: string;

  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content cannot be empty' })
  content: string;
}

export class ChatRequestDto {
  @IsString({ message: 'Model must be a string' })
  @IsNotEmpty({ message: 'Model name cannot be empty' })
  // @IsValidModel()
  model: string;

  @IsArray({ message: 'Messages must be an array' })
  @ArrayMinSize(1, { message: 'At least one message is required' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages: ChatMessage[];

  @IsOptional()
  @IsObject({ message: 'Options must be a valid JSON object' })
  options?: Record<string, any>;

  @IsOptional()
  @IsBoolean({ message: 'Think must be a boolean' })
  think?: boolean;
}

export class GenerateRequestDto {
  @IsString({ message: 'Model must be a string' })
  @IsNotEmpty({ message: 'Model name cannot be empty' })
  //@IsValidModel()
  model: string;

  @IsString({ message: 'Prompt must be a string' })
  @IsNotEmpty({ message: 'Prompt cannot be empty' })
  prompt: string;

  @IsOptional()
  @IsObject({ message: 'Options must be a valid JSON object' })
  options?: Record<string, any>;

  @IsOptional()
  @IsBoolean({ message: 'Think must be a boolean' })
  think?: boolean;
}
