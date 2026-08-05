import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailOtp } from './entities/email-otp.entity';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(EmailOtp)
    private otpRepo: Repository<EmailOtp>,
  ) {}

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
    });

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

    const storedToken = await this.refreshTokenRepo.findOne({
      where: { userId: payload.sub, revoked: false },
      order: { createdAt: 'DESC' },
    });

    if (!storedToken) {
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
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
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

  async generateOtp(email: string) {
    await this.cleanupExpiredOtp();

    const existingValidOtp = await this.otpRepo.findOne({
      where: { email, verifiedAt: IsNull() },
      order: { createdAt: 'DESC' }
    });

    if (existingValidOtp && existingValidOtp.expiresAt > new Date()) {
      return { message: 'OTP already sent.', expiresAt: existingValidOtp.expiresAt };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    
    const expiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    await this.otpRepo.save(
      this.otpRepo.create({
        email,
        otp: hashedOtp,
        expiresAt,
      })
    );

    const sent = await this.mailService.sendOtpEmail(email, otp);
    if (!sent) {
      throw new BadRequestException('Failed to send OTP email');
    }

    return { message: 'OTP sent successfully', expiresAt };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const record = await this.otpRepo.findOne({
      where: { email: verifyOtpDto.email, verifiedAt: IsNull() },
      order: { createdAt: 'DESC' }
    });

    if (!record) {
      throw new NotFoundException('OTP record not found');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    const isValid = await bcrypt.compare(verifyOtpDto.otp, record.otp);
    if (!isValid) {
      record.attempts += 1;
      await this.otpRepo.save(record);
      throw new BadRequestException('Invalid OTP');
    }

    record.verifiedAt = new Date();
    await this.otpRepo.save(record);

    return { success: true, message: 'OTP verified successfully' };
  }

  async cleanupExpiredOtp() {
    await this.otpRepo.delete({
      expiresAt: LessThan(new Date()),
      verifiedAt: IsNull()
    });
  }
}
