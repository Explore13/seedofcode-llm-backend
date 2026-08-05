import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const prefix = isProd ? 'PROD_DB' : 'DEV_DB';

export default new DataSource({
  type: 'postgres',
  host: process.env[`${prefix}_HOST`],
  port: Number(process.env[`${prefix}_PORT`] || 5432),
  username: process.env[`${prefix}_USER`],
  password: process.env[`${prefix}_PASSWORD`],
  database: process.env[`${prefix}_NAME`],
  entities: ['src/**/*.entity.ts'],
  synchronize: false,
  migrations: ['src/database/migrations/*.ts'],
  ssl: process.env[`${prefix}_SSL`] === 'true' ? {
    rejectUnauthorized: false,
  } : false,
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
  },
});
