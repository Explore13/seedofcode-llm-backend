import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OllamaModule } from '../../common/ollama/ollama.module';
import { CreditsModule } from '../credits/credits.module';
import { ModelsModule } from '../models/models.module';
import { GenerationProcessor } from './generation.processor';

@Module({
  imports: [
    OllamaModule,
    CreditsModule,
    ModelsModule,
    BullModule.registerQueue({
      name: 'generation',
      defaultJobOptions: {
        // No automatic retries: a generation is not safely replayable and the
        // caller is already streaming/awaiting a single attempt.
        attempts: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    }),
  ],
  controllers: [],
  providers: [GenerationProcessor],
})
export class WorkerModule {}
