import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('credits/wallet')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) { }

  @Get('balance')
  async getWallet(@Request() req) {
    const userId = req.user.id;
    return this.creditsService.getWallet(userId);
  }

  @Post('sync')
  async syncWallet(@Request() req) {
    const userId = req.user.id;
    return this.creditsService.checkAndCreateWallet(userId);
  }
}
