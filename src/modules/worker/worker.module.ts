import { Module } from '@nestjs/common';
import { OllamaModule } from '../../common/ollama/ollama.module';

@Module({
  imports: [OllamaModule],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
