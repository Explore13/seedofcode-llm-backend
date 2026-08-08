import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InferenceController } from './inference.controller';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'generation',
    }),
    AuthModule,
    ModelsModule
  ],
  controllers: [InferenceController],
})
export class InferenceModule { }
