import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private publisherClient: Redis;
  private subscriberClient: Redis;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.publisherClient = new Redis({ host, port, password });
    this.subscriberClient = new Redis({ host, port, password });
  }

  onModuleDestroy() {
    this.publisherClient.disconnect();
    this.subscriberClient.disconnect();
  }

  async publish(channel: string, message: string) {
    return this.publisherClient.publish(channel, message);
  }

  getSubscriber() {
    return this.subscriberClient;
  }
}
