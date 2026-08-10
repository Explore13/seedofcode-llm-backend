import { Controller, Get, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { UsageService } from './usage.service';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { GetUsageQueryDto } from './dto/usage.dto';

@Controller('usage')
@UseGuards(HybridAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getUsage(
    @Req() req: any,
    @Query(new ValidationPipe({ transform: true })) query: GetUsageQueryDto,
  ) {
    return this.usageService.getUserUsage(req.user.id, query);
  }

  @Get('today')
  async getTodayUsage(@Req() req: any) {
    return this.usageService.getTodayUsageSummary(req.user.id);
  }
}
