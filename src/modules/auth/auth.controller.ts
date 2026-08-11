import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { AllowUnverified } from './decorators/allow-unverified.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refresh_token);
  }

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @AllowUnverified()
  @Post('logout')
  @ApiOperation({ summary: 'Logout user and invalidate refresh tokens' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @AllowUnverified()
  @Get('me')
  @ApiOperation({ summary: 'Get current logged in user details' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  getProfile(@Req() req: any) {
    const { password, ...userWithoutPassword } = req.user;
    return userWithoutPassword;
  }

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @AllowUnverified()
  @Post('otp/generate')
  @ApiOperation({ summary: 'Generate and send OTP to email (Resend)' })
  @ApiResponse({ status: 201, description: 'OTP sent' })
  async generateOtp(@Req() req: any) {
    return this.authService.requestEmailVerification(req.user.id);
  }

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @AllowUnverified()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Req() req: any, @Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.confirmEmailVerification(
      req.user.id,
      verifyOtpDto.otp,
    );
  }
}
