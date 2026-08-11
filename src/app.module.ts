import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModulesModule } from './modules/modules.module';
import { typeOrmConfig } from './config/db';
import { validateEnv } from './config/env.validation';
import { RedisModule } from './common/redis/redis.module';
import { HybridAuthGuard } from './modules/auth/guards/hybrid-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              }
            : undefined,
      },
      forRoutes: ['*path'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    ModulesModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Block unauthenticated (guest) traffic app-wide by default. Routes opt out
    // with @Public(); HybridAuthGuard accepts both JWT and API-key bearers.
    { provide: APP_GUARD, useExisting: HybridAuthGuard },
  ],
})
export class AppModule {}
