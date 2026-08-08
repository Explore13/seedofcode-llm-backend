import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InferenceController } from './inference.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'generation',
    }),
    AuthModule
  ],
  controllers: [InferenceController],
})
export class InferenceModule { }
