import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OllamaService } from '../../common/ollama/ollama.service';
import { RedisService } from '../../common/redis/redis.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { ModelsService } from '../models/models.service';
import { UsageStatus } from '../usage/entities/usage-log.entity';

/** Distinguishes a timeout from a generic failure so we can settle correctly. */
class GenerationTimeoutError extends Error { }

@Processor('generation', {
  concurrency: 1, // Only process 1 generation job at a time per worker instance
  // Lock must comfortably exceed the generation timeout so BullMQ doesn't mark a
  // long-but-healthy job as stalled and re-run it. Settlement is idempotent, so
  // even an unexpected re-run cannot double-charge.
  lockDuration: 300_000,
  stalledInterval: 30_000,
})
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly redisService: RedisService,
    private readonly creditsService: CreditsService,
    private readonly modelsService: ModelsService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.timeoutMs = Number(
      this.configService.get('GENERATION_TIMEOUT_MS', 120_000),
    );
  }

  /** Reject with GenerationTimeoutError if `p` doesn't settle within `ms`. */
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new GenerationTimeoutError(`Generation exceeded ${ms}ms`)),
        ms,
      );
    });
    return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(
      `[Job ${job.id}] Picked up ${job.name} job for model: ${job.data.model}`,
    );

    // Extract everything we added to the payload
    const { stream, userId, apiKeyId, reservationContext, ...params } =
      job.data;
    const channel = `stream:${job.id}`;
    const startTime = Date.now();

    // 1. Get model pricing from Reservation Context
    const creditsPerInputToken = reservationContext?.creditsPerInputToken || 0;
    const creditsPerOutputToken =
      reservationContext?.creditsPerOutputToken || 0;

    let tokensStreamedSoFar = 0;
    let finalPromptTokens = 0;
    let finalCompletionTokens = 0;

    try {
      if (stream) {
        this.logger.debug(`[Job ${job.id}] Initiating stream via Ollama...`);

        // Consume the whole stream under a single timeout budget so a hung
        // Ollama connection can't block the (concurrency-1) worker forever.
        const consume = (async () => {
          let streamResponse;
          if (job.name === 'chat') {
            streamResponse = await this.ollamaService.chatStream(params as any);
          } else if (job.name === 'generate') {
            streamResponse = await this.ollamaService.generateStream(
              params as any,
            );
          } else {
            throw new Error(`Unknown job name: ${job.name}`);
          }

          let chunkCount = 0;
          for await (const chunk of streamResponse) {
            chunkCount++;
            if (chunkCount === 1) {
              this.logger.debug(
                `[Job ${job.id}] Received first chunk from Ollama`,
              );
            }

            // Ollama chunks roughly correspond to tokens (not strictly 1:1).
            tokensStreamedSoFar++;

            // Capture authoritative final counts when present.
            if (chunk.done) {
              finalPromptTokens = chunk.prompt_eval_count || 0;
              finalCompletionTokens = chunk.eval_count || tokensStreamedSoFar;
            }

            await this.redisService.publish(channel, JSON.stringify(chunk));
          }
          return chunkCount;
        })();

        const chunkCount = await this.withTimeout(consume, this.timeoutMs);

        await this.redisService.publish(channel, '[DONE]');
        this.logger.log(
          `[Job ${job.id}] Stream completed successfully. Emitted ${chunkCount} chunks.`,
        );

        // Settle success (Streaming)
        await this.settleJob(
          job,
          userId,
          reservationContext,
          finalPromptTokens,
          finalCompletionTokens,
          Date.now() - startTime,
          UsageStatus.SUCCESS,
          creditsPerInputToken,
          creditsPerOutputToken,
          apiKeyId,
        );

        return { success: true };
      } else {
        this.logger.debug(
          `[Job ${job.id}] Initiating standard request to Ollama...`,
        );
        let response;
        if (job.name === 'chat') {
          response = await this.withTimeout(
            this.ollamaService.chat(params as any),
            this.timeoutMs,
          );
        } else if (job.name === 'generate') {
          response = await this.withTimeout(
            this.ollamaService.generate(params as any),
            this.timeoutMs,
          );
        } else {
          throw new Error(`Unknown job name: ${job.name}`);
        }

        finalPromptTokens = response.promptTokens || 0;
        finalCompletionTokens = response.completionTokens || 0;

        this.logger.log(`[Job ${job.id}] Request completed successfully.`);

        // Settle success (Non-streaming)
        await this.settleJob(
          job,
          userId,
          reservationContext,
          finalPromptTokens,
          finalCompletionTokens,
          Date.now() - startTime,
          UsageStatus.SUCCESS,
          creditsPerInputToken,
          creditsPerOutputToken,
          apiKeyId,
        );

        return response;
      }
    } catch (error: any) {
      const isTimeout = error instanceof GenerationTimeoutError;
      const status = isTimeout ? UsageStatus.TIMEOUT : UsageStatus.ERROR;
      this.logger.error(`[Job ${job.id}] Failed (${status}): ${error.message}`);

      if (stream) {
        await this.redisService.publish(channel, `[ERROR] ${error.message}`);
      }

      const promptTokens = finalPromptTokens;
      const completionTokens = stream
        ? finalCompletionTokens || tokensStreamedSoFar
        : 0;

      await this.settleJob(
        job,
        userId,
        reservationContext,
        promptTokens,
        completionTokens,
        Date.now() - startTime,
        status,
        creditsPerInputToken,
        creditsPerOutputToken,
        apiKeyId,
      );

      throw error;
    }
  }

  private async settleJob(
    job: Job,
    userId: string,
    reservationContext: any,
    promptTokens: number,
    completionTokens: number,
    latencyMs: number,
    status: UsageStatus,
    creditsPerInputToken: number,
    creditsPerOutputToken: number,
    apiKeyId?: string | null,
  ) {
    if (!reservationContext || !reservationContext.transactionId) {
      return; // Free request or no context, nothing to settle
    }

    const inputCost = (promptTokens / 1000) * creditsPerInputToken;
    const outputCost = (completionTokens / 1000) * creditsPerOutputToken;
    const actualCost = Math.ceil(inputCost + outputCost);

    const usageLogData = {
      userId,
      model: job.data.model,
      apiKeyId,
      promptTokens,
      completionTokens,
      latencyMs,
      status,
      creditsCost: actualCost, // overwritten by the service anyway, but explicit
    };

    // settleReservation is idempotent (guards on usage-log status), so it is
    // safe to retry a few times before giving up, rather than silently leaving
    // the ledger inconsistent on a transient DB error.
    const MAX_SETTLE_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_SETTLE_ATTEMPTS; attempt++) {
      try {
        await this.creditsService.settleReservation(
          userId,
          reservationContext.transactionId,
          reservationContext.reservedAmount,
          actualCost,
          usageLogData,
        );
        return;
      } catch (e: any) {
        this.logger.error(
          `[Job ${job.id}] settleReservation attempt ${attempt}/${MAX_SETTLE_ATTEMPTS} failed: ${e.message}`,
        );
        if (attempt === MAX_SETTLE_ATTEMPTS) {
          // Last resort: surface loudly. The reservation stays debited and no
          // usage log is created — this needs an operational alert / manual
          // reconciliation (a dead-letter queue is the Phase-2 hardening).
          this.logger.error(
            `[Job ${job.id}] CRITICAL: reservation ${reservationContext.transactionId} could not be settled after ${MAX_SETTLE_ATTEMPTS} attempts.`,
            e.stack,
          );
        }
      }
    }
  }
}
