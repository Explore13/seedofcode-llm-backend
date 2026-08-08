import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OllamaModule } from '../../common/ollama/ollama.module';
import { GenerationProcessor } from './generation.processor';

@Module({
  imports: [
    OllamaModule,
    BullModule.registerQueue({
      name: 'generation',
    }),
  ],
  controllers: [],
  providers: [GenerationProcessor],
})
export class WorkerModule {}
