import { Module } from '@nestjs/common';
import { AdminModelsController } from './admin-models.controller';
import { AdminCreditsController } from './admin-credits.controller';
import { AdminUsageController } from './admin-usage.controller';
import { ModelsModule } from '../models/models.module';
import { CreditsModule } from '../credits/credits.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [ModelsModule, CreditsModule, UsageModule],
  controllers: [
    AdminModelsController,
    AdminCreditsController,
    AdminUsageController,
  ],
})
export class AdminModule {}
