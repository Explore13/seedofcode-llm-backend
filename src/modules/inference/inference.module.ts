import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InferenceController } from './inference.controller';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { IsValidModelConstraint } from './validators/is-valid-model.validator';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'generation',
    }),
    AuthModule,
    ModelsModule,
    CreditsModule,
  ],
  controllers: [InferenceController],
  providers: [IsValidModelConstraint],
})
export class InferenceModule {}
