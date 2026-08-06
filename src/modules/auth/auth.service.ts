import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { UserService } from '../user/user.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpPurpose } from './entities/email-otp.entity';
import { OtpService } from './otp.service';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) { }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      // verified: false is default from the DB
    });

    // Automatically generate OTP in the background
    this.requestEmailVerification(user.id).catch(e => console.error('Failed to auto-generate OTP on register', e));

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refresh(token: string) {
    let payload;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.refreshTokenRepo.findOne({
      where: { id: payload.jti },
    });

    if (!storedToken || storedToken.revoked) {
      throw new UnauthorizedException('Refresh token revoked or invalid');
    }

    const isMatch = await bcrypt.compare(token, storedToken.tokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userService.findById(payload.sub);

    // Rotate refresh token: revoke old one
    storedToken.revoked = true;
    await this.refreshTokenRepo.save(storedToken);

    return this.generateTokens(user);
  }

  async logout(userId: string) {
    // Revoke all refresh tokens for this user for security
    await this.refreshTokenRepo.update({ userId }, { revoked: true });
    return { success: true, message: 'Logged out successfully' };
  }

  private async generateTokens(user: User) {
    const payload = { email: user.email, sub: user.id, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const jti = randomUUID();

    const refreshToken = this.jwtService.sign({ ...payload, jti }, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        id: jti,
        userId: user.id,
        tokenHash: hashedRefreshToken,
        expiresAt,
      }),
    );

    const { password, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithoutPassword,
    };
  }

  // OTP System

  async requestEmailVerification(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.verified) {
      return { alreadyVerified: true, message: 'User is already verified' };
    }

    return this.otpService.generate(userId, user.email, OtpPurpose.EMAIL_VERIFICATION);
  }

  async confirmEmailVerification(userId: string, otp: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.verified) {
      return { alreadyVerified: true, message: 'User is already verified' };
    }

    await this.otpService.verify(userId, otp, OtpPurpose.EMAIL_VERIFICATION);

    await this.userService.update(user.id, { verified: true });

    return { verified: true, message: 'Email verified successfully' };
  }
}
