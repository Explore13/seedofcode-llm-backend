import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { OllamaService } from '../../common/ollama/ollama.service';
import { Public } from '../auth/decorators/public.decorator';

type IndicatorResult = { status: 'up' | 'down'; [key: string]: unknown };

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly ollamaService: OllamaService,
  ) {}

  @Get()
  async check() {
    const [database, redis, ollama] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
    ]);
    const healthy = [database, redis, ollama].every((s) => s.status === 'up');
    return {
      status: healthy ? 'ok' : 'degraded',
      info: { database, redis, ollama },
    };
  }

  @Get('database')
  database() {
    return this.checkDatabase();
  }

  @Get('redis')
  redis() {
    return this.checkRedis();
  }

  @Get('ollama')
  ollama() {
    return this.checkOllama();
  }

  private async checkDatabase(): Promise<IndicatorResult> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }

  private async checkRedis(): Promise<IndicatorResult> {
    try {
      const pong = await this.redisService.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }

  private async checkOllama(): Promise<IndicatorResult> {
    try {
      const list = await this.ollamaService.listModels();
      return { status: 'up', models: list?.models?.length ?? 0 };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }
}
