import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OllamaService } from '../../common/ollama/ollama.service';
import { RedisService } from '../../common/redis/redis.service';
import { Logger } from '@nestjs/common';

@Processor('generation', {
  concurrency: 1, // Only process 1 generation job at a time per worker instance (Ollama can be resource-heavy)
})
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[Job ${job.id}] Picked up ${job.name} job for model: ${job.data.model}`);
    const { stream, ...params } = job.data;
    const channel = `stream:${job.id}`;

    try {
      if (stream) {
        this.logger.debug(`[Job ${job.id}] Initiating stream via Ollama...`);
        let streamResponse;
        if (job.name === 'chat') {
          streamResponse = await this.ollamaService.chatStream(params as any);
        } else if (job.name === 'generate') {
          streamResponse = await this.ollamaService.generateStream(params as any);
        } else {
          throw new Error(`Unknown job name: ${job.name}`);
        }

        let chunkCount = 0;
        for await (const chunk of streamResponse) {
          chunkCount++;
          if (chunkCount === 1) {
            this.logger.debug(`[Job ${job.id}] Received first chunk from Ollama`);
          }
          await this.redisService.publish(channel, JSON.stringify(chunk));
        }

        await this.redisService.publish(channel, '[DONE]');
        this.logger.log(`[Job ${job.id}] Stream completed successfully. Emitted ${chunkCount} chunks.`);
        return { success: true };
      } else {
        this.logger.debug(`[Job ${job.id}] Initiating standard request to Ollama...`);
        let response;
        if (job.name === 'chat') {
          response = await this.ollamaService.chat(params as any);
        } else if (job.name === 'generate') {
          response = await this.ollamaService.generate(params as any);
        } else {
          throw new Error(`Unknown job name: ${job.name}`);
        }
        this.logger.log(`[Job ${job.id}] Request completed successfully.`);
        return response;
      }
    } catch (error: any) {
      this.logger.error(`[Job ${job.id}] Failed with error: ${error.message}`);
      if (stream) {
        await this.redisService.publish(channel, `[ERROR] ${error.message}`);
      }
      throw error;
    }
  }
}
