import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private publisherClient: Redis;
  private subscriberClient: Redis;

  constructor(private readonly configService: ConfigService) { }

  private readonly logger = new Logger(RedisService.name);

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.publisherClient = new Redis({ host, port, password });
    this.subscriberClient = new Redis({ host, port, password });

    // Without an 'error' listener, ioredis re-emits connection errors as
    // unhandled exceptions that can crash the process on transient failures.
    this.publisherClient.on('error', (err) =>
      this.logger.error(`Redis publisher error: ${err.message}`),
    );
    this.subscriberClient.on('error', (err) =>
      this.logger.error(`Redis subscriber error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    // quit() drains in-flight commands before closing; disconnect() drops them.
    await Promise.allSettled([
      this.publisherClient?.quit(),
      this.subscriberClient?.quit(),
    ]);
  }

  async publish(channel: string, message: string) {
    return this.publisherClient.publish(channel, message);
  }

  async ping(): Promise<string> {
    return this.publisherClient.ping();
  }

  getSubscriber() {
    return this.subscriberClient;
  }
}
