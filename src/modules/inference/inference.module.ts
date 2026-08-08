import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InferenceController } from './inference.controller';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { IsValidModelConstraint } from './validators/is-valid-model.validator';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'generation',
    }),
    AuthModule,
    ModelsModule
  ],
  controllers: [InferenceController],
  providers: [IsValidModelConstraint],
})
export class InferenceModule { }
