import { Controller, Post, Body, Sse, UseGuards, Req, Request } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { Observable } from 'rxjs';
import { ChatRequestDto, GenerateRequestDto } from './dto/inference.dto';
import { RedisService } from '../../common/redis/redis.service';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';

@UseGuards(HybridAuthGuard)
@Controller()
export class InferenceController {
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue('generation') private readonly generationQueue: Queue,
    private readonly redisService: RedisService,
  ) {
    this.queueEvents = new QueueEvents('generation', { connection: this.generationQueue.opts.connection });
  }

  @Post('chat')
  async chat(@Body() body: ChatRequestDto) {
    const job = await this.generationQueue.add('chat', { ...body, stream: false });
    return await job.waitUntilFinished(this.queueEvents);
  }

  @Post('generate')
  async generate(@Body() body: GenerateRequestDto) {
    const job = await this.generationQueue.add('generate', { ...body, stream: false });
    return await job.waitUntilFinished(this.queueEvents);
  }

  @Post('chat/stream')
  @Sse()
  async chatStream(@Body() body: ChatRequestDto): Promise<Observable<any>> {
    const job = await this.generationQueue.add('chat', { ...body, stream: true });
    return this.createStreamObservable(job.id!);
  }

  @Post('generate/stream')
  @Sse()
  async generateStream(@Body() body: GenerateRequestDto): Promise<Observable<any>> {
    const job = await this.generationQueue.add('generate', { ...body, stream: true });
    return this.createStreamObservable(job.id!);
  }

  private createStreamObservable(jobId: string): Observable<any> {
    const channel = `stream:${jobId}`;
    const subscriber = this.redisService.getSubscriber();

    return new Observable((observer) => {
      subscriber.subscribe(channel, (err) => {
        if (err) {
          observer.error(err);
        }
      });

      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          if (message === '[DONE]') {
            observer.complete();
            cleanUp();
          } else if (message.startsWith('[ERROR]')) {
            observer.error(new Error(message));
            cleanUp();
          } else {
            observer.next({ data: JSON.parse(message) });
          }
        }
      };

      subscriber.on('message', messageHandler);

      const cleanUp = () => {
        subscriber.unsubscribe(channel);
        subscriber.off('message', messageHandler);
      };

      return cleanUp;
    });
  }
}
