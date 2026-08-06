import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModulesModule } from './modules/modules.module';
import { typeOrmConfig } from './config/db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    ModulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
