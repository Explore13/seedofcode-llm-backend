import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageLog } from './entities/usage-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsageLog])],
  controllers: [],
  providers: [],
})
export class UsageModule {}
