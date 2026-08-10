import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageLog } from './entities/usage-log.entity';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsageLog])],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule { }
