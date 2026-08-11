import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { CreditsService } from '../credits/credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreditTransactionReason } from '../credits/entities/credit-transaction.entity';
import { UpdateWalletBalanceDto } from './dto/admin-credits.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/credits/wallet')
export class AdminCreditsController {
  constructor(private readonly creditsService: CreditsService) { }

  // @Post(':userId')
  // async createWallet(@Param('userId', ParseUUIDPipe) userId: string) {
  //   return this.creditsService.createWallet(userId);
  // }

  @Get(':userId/balance')
  async getWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.creditsService.getWallet(userId);
  }

  @Patch(':userId')
  async updateWalletBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateWalletBalanceDto: UpdateWalletBalanceDto,
  ) {
    return this.creditsService.updateWalletBalance(userId, updateWalletBalanceDto.amount, CreditTransactionReason.ADMIN_ADJUSTMENT);
  }

  @Delete(':userId')
  async deleteWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    await this.creditsService.deleteWallet(userId);
    return { success: true, message: 'Wallet deleted successfully' };
  }

  @Post(':userId/sync')
  async syncWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.creditsService.checkAndCreateWallet(userId);
  }
}
