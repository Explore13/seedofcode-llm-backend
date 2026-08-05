import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ApiKeysModule } from './apikeys/apikeys.module';
import { CreditsModule } from './credits/credits.module';
import { UsageModule } from './usage/usage.module';
import { ModelsModule } from './models/models.module';
import { WorkerModule } from './worker/worker.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    ApiKeysModule,
    CreditsModule,
    UsageModule,
    ModelsModule,
    WorkerModule,
    MailModule,
    ApiKeysModule,
  ],
  controllers: [],
  providers: [],
})
export class ModulesModule {}
