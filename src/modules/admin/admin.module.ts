import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModelsController } from './admin-models.controller';
import { ModelsModule } from '../models/models.module';
import { ModelInfo } from '../models/entities/model-info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModelInfo]), ModelsModule],
  controllers: [AdminModelsController],
})
export class AdminModule {}
