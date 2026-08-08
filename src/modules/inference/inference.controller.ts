import { Controller, Post, Body, Sse, UseGuards, Req, Request, Get } from '@nestjs/common';
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

  // DEMONSTRATION ROUTE: Open two terminal tabs.
  // Tab 1: curl http://localhost:3000/api/block-event-loop
  // Tab 2 (immediately after): curl http://localhost:3000/api/apikeys (or any other route)
  // You will see Tab 2 completely HANGS for 10 seconds because Tab 1 froze the entire Node.js server!
  // @Get('block-event-loop')
  // blockEventLoop() {
  //   console.log("FREEZING THE SERVER FOR 10 SECONDS...");
  //   const end = Date.now() + 10000;
  //   while (Date.now() < end) {
  //     // This is a synchronous loop. Node.js is physically incapable of looking at other HTTP requests right now.
  //     Math.sqrt(Math.random());
  //   }
  //   console.log("SERVER UN-FROZEN!");
  //   return { message: 'The event loop is finally free! All other requests can now process.' };
  // }

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
