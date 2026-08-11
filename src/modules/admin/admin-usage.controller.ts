import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { UsageService } from '../usage/usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { AdminGetUsageQueryDto } from '../usage/dto/usage.dto';

@Controller('admin/usage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsageController {
  constructor(private readonly usageService: UsageService) { }

  @Get()
  async getUsage(
    @Query(new ValidationPipe({ transform: true })) query: AdminGetUsageQueryDto,
  ) {
    return this.usageService.getAdminUsage(query);
  }

  @Get('today')
  async getTodayUsageSummary() {
    return this.usageService.getTodayUsageSummary();
  }
}
