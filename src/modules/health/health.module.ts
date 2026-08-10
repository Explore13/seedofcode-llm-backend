import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OllamaModule } from '../../common/ollama/ollama.module';

@Module({
  imports: [OllamaModule],
  controllers: [HealthController],
})
export class HealthModule {}
