import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const prefix = isProd ? 'PROD_DB' : 'DEV_DB';

  return {
    type: 'postgres',
    host: config.get<string>(`${prefix}_HOST`),
    port: config.get<number>(`${prefix}_PORT`, 5432),
    username: config.get<string>(`${prefix}_USER`),
    password: config.get<string>(`${prefix}_PASSWORD`),
    database: config.get<string>(`${prefix}_NAME`),
    autoLoadEntities: true,
    synchronize: false,
    logging: !isProd,
    // Verify the server certificate in production (Neon presents a valid CA
    // chain); disabling verification there would expose the DB link to MITM.
    ssl:
      config.get<string>(`${prefix}_SSL`) === 'true'
        ? {
            rejectUnauthorized: isProd,
          }
        : false,
    retryAttempts: 10,
    retryDelay: 3000,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
    },
  };
};
