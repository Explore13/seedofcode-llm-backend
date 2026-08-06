import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelInfo } from './entities/model-info.entity';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';
import { AuthModule } from '../auth/auth.module';
import { OllamaModule } from '../../common/ollama/ollama.module';

@Module({
  imports: [TypeOrmModule.forFeature([ModelInfo]), AuthModule, OllamaModule],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
