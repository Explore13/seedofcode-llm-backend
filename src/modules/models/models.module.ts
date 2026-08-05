import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelInfo } from './entities/model-info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModelInfo])],
  controllers: [],
  providers: [],
})
export class ModelsModule {}
