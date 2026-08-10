import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  OnModuleDestroy,
  Post,
  Req,
  Sse,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { ChatRequestDto, GenerateRequestDto } from './dto/inference.dto';
import { RedisService } from '../../common/redis/redis.service';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { CreditsService } from '../credits/credits.service';
import { ModelsService } from '../models/models.service';
import { UsageStatus } from '../usage/entities/usage-log.entity';

interface ReservationContext {
  transactionId: string | null;
  reservedAmount: number;
  clampedMaxTokens: number;
  estimatedPromptTokens: number;
  creditsPerInputToken: number;
  creditsPerOutputToken: number;
}

@UseGuards(HybridAuthGuard)
@Controller()
export class InferenceController {
  private readonly logger = new Logger(InferenceController.name);
  private readonly queueEvents: QueueEvents;
  private readonly DEFAULT_MAX_TOKENS = 1024;
  private readonly CEILING_MAX_TOKENS = 4096;

  constructor(
    @InjectQueue('generation') private readonly generationQueue: Queue,
    private readonly redisService: RedisService,
    private readonly creditsService: CreditsService,
    private readonly modelsService: ModelsService,
  ) {
    this.queueEvents = new QueueEvents('generation', {
      connection: this.generationQueue.opts.connection,
    });
  }


  private apiKeyIdOf(req: any): string | null {
    return req.user?.authMethod === 'api_key' ? req.user.apiKeyId : null;
  }

  /**
   * Reserve credits for a request. Runs inside the handler (AFTER the global
   * ValidationPipe), so an invalid body can never debit the wallet — the credit
   * leak that existed when this lived in a guard (guards run before pipes).
   */
  private async reserve(
    req: any,
    body: ChatRequestDto | GenerateRequestDto,
  ): Promise<ReservationContext> {

    // 1. Check Model Validity
    const model = await this.modelsService.findByName(body.model);
    if (!model || !model.enabled) {
      throw new BadRequestException(
        `Model '${body.model}' is not available or disabled.`,
      );
    }

    // 2. Estimate prompt tokens (cheap heuristic: ~4 chars per token).
    let promptText = '';
    if ('messages' in body && Array.isArray(body.messages)) {
      promptText = body.messages.map((m) => m.content).join(' ');
    } else if ('prompt' in body && body.prompt) {
      promptText = body.prompt;
    }
    const estimatedPromptTokens = Math.ceil(promptText.length / 4);

    // 3. Determine and clamp max output tokens, then write the clamped value back
    // so the worker sends it to Ollama.
    let requestedMaxTokens = body.options?.num_predict;
    if (typeof requestedMaxTokens !== 'number' || requestedMaxTokens <= 0) {
      requestedMaxTokens = this.DEFAULT_MAX_TOKENS;
    }
    const clampedMaxTokens = Math.min(
      requestedMaxTokens,
      this.CEILING_MAX_TOKENS,
    );
    if (!body.options) {
      body.options = {};
    }
    body.options.num_predict = clampedMaxTokens;

    const inputCost =
      (estimatedPromptTokens / 1000) * model.creditsPerInputToken;
    const outputCost = (clampedMaxTokens / 1000) * model.creditsPerOutputToken;
    const totalEstimatedCost = Math.ceil(inputCost + outputCost);

    const base = {
      clampedMaxTokens,
      estimatedPromptTokens,
      creditsPerInputToken: model.creditsPerInputToken,
      creditsPerOutputToken: model.creditsPerOutputToken,
    };

    if (totalEstimatedCost <= 0) {
      return { transactionId: null, reservedAmount: 0, ...base };
    }

    // Throws 402 Payment Required if the wallet can't cover the estimate.
    const reservation = await this.creditsService.reserveCredits(
      req.user.id,
      totalEstimatedCost,
    );

    return {
      transactionId: reservation.transactionId,
      reservedAmount: reservation.reservedAmount,
      ...base,
    };
  }

  /** Fully refund a reservation whose job never made it onto the queue. */
  private async refundReservation(
    userId: string,
    ctx: ReservationContext,
    model: string,
  ) {
    if (!ctx?.transactionId) {
      return;
    }
    try {
      await this.creditsService.settleReservation(
        userId,
        ctx.transactionId,
        ctx.reservedAmount,
        0,
        {
          userId,
          model,
          apiKeyId: null,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
          status: UsageStatus.ERROR,
          creditsCost: 0,
        },
      );
    } catch (e) {
      this.logger.error(
        `Failed to refund reservation ${ctx.transactionId} after enqueue failure`,
        e as Error,
      );
    }
  }

  @Post('chat')
  async chat(@Req() req: any, @Body() body: ChatRequestDto) {
    const ctx = await this.reserve(req, body);
    const job = await this.enqueue('chat', body, req, ctx, false);
    try {
      return await job.waitUntilFinished(this.queueEvents);
    } catch (e: any) {
      throw new HttpException(
        e.message || 'Generation failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('generate')
  async generate(@Req() req: any, @Body() body: GenerateRequestDto) {
    const ctx = await this.reserve(req, body);
    const job = await this.enqueue('generate', body, req, ctx, false);
    try {
      return await job.waitUntilFinished(this.queueEvents);
    } catch (e: any) {
      throw new HttpException(
        e.message || 'Generation failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('chat/stream')
  @Sse()
  async chatStream(
    @Req() req: any,
    @Body() body: ChatRequestDto,
  ): Promise<Observable<any>> {
    const ctx = await this.reserve(req, body);
    return this.createStreamObservable('chat', body, req, ctx);
  }

  @Post('generate/stream')
  @Sse()
  async generateStream(
    @Req() req: any,
    @Body() body: GenerateRequestDto,
  ): Promise<Observable<any>> {
    const ctx = await this.reserve(req, body);
    return this.createStreamObservable('generate', body, req, ctx);
  }

  private async enqueue(
    name: 'chat' | 'generate',
    body: ChatRequestDto | GenerateRequestDto,
    req: any,
    ctx: ReservationContext,
    stream: boolean,
    jobId?: string,
  ) {
    const jobData = {
      ...body,
      stream,
      userId: req.user.id,
      apiKeyId: this.apiKeyIdOf(req),
      reservationContext: ctx,
    };
    try {
      return await this.generationQueue.add(
        name,
        jobData,
        jobId ? { jobId } : undefined,
      );
    } catch (e) {
      // The reservation already debited the wallet; give it back.
      await this.refundReservation(req.user.id, ctx, body.model);
      throw e;
    }
  }

  private createStreamObservable(
    name: 'chat' | 'generate',
    body: ChatRequestDto | GenerateRequestDto,
    req: any,
    ctx: ReservationContext,
  ): Observable<any> {
    // Pre-generate the job id so we can subscribe to its channel BEFORE the job
    // is enqueued. Redis pub/sub has no backlog, so subscribing after enqueue
    // could miss early tokens (or even [DONE]) published by a fast worker.
    const jobId = randomUUID();
    const channel = `stream:${jobId}`;
    const subscriber = this.redisService.getSubscriber();
    const userId = req.user.id;

    return new Observable((observer) => {
      const messageHandler = (ch: string, message: string) => {
        if (ch !== channel) {
          return;
        }
        if (message === '[DONE]') {
          observer.complete();
          cleanUp();
        } else if (message.startsWith('[ERROR]')) {
          observer.error(new Error(message));
          cleanUp();
        } else {
          observer.next({ data: JSON.parse(message) });
        }
      };

      const cleanUp = () => {
        subscriber.unsubscribe(channel);
        subscriber.off('message', messageHandler);
      };

      subscriber.on('message', messageHandler);

      // Only enqueue once the subscription is established.
      subscriber.subscribe(channel, (err) => {
        if (err) {
          observer.error(err);
          cleanUp();
          return;
        }
        this.enqueue(name, body, req, ctx, true, jobId).catch((e) => {
          // enqueue() already refunded the reservation on failure.
          observer.error(e);
          cleanUp();
        });
      });

      return cleanUp;
    });
  }
}
