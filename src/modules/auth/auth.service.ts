import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';

import { UserService } from '../user/user.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpPurpose } from './entities/email-otp.entity';
import { OtpService } from './otp.service';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { User } from '../user/entities/user.entity';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Precomputed valid bcrypt hash used to keep login timing constant when the
  // email doesn't exist (defeats the user-enumeration timing oracle).
  private readonly dummyPasswordHash = bcrypt.hashSync(
    'timing-attack-mitigation',
    10,
  );

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private creditsService: CreditsService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) { }

  private hashToken(token: string): string {
    // SHA-256, not bcrypt: a signed JWT exceeds bcrypt's 72-byte input cap and
    // would be silently truncated. The token is already high-entropy.
    return createHash('sha256').update(token).digest('hex');
  }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      // verified: false is default from the DB
    });

    // Per architecture §5.4, every new user gets a wallet + signup-bonus ledger
    // entry at registration. Best-effort: a failure here shouldn't block signup
    // (the user can self-heal later via POST /credits/wallet/sync).
    // try {
    //   await this.creditsService.createWallet(user.id);
    // } catch (e) {
    //   this.logger.error(
    //     `Failed to create wallet on register for user ${user.id}`,
    //     e as Error,
    //   );
    // }

    // Automatically generate OTP in the background
    this.requestEmailVerification(user.id).catch((e) =>
      this.logger.error('Failed to auto-generate OTP on register', e),
    );

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);

    // Always run a bcrypt comparison (against a dummy hash when the user is
    // missing) so response time doesn't reveal whether the email exists.
    const passwordHash = user?.password ?? this.dummyPasswordHash;
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      passwordHash,
    );

    if (!user || !isPasswordValid) {
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

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token revoked or invalid');
    }

    // Reuse of an already-rotated (revoked) token signals possible theft.
    // Revoke the entire token family for this user and reject.
    if (storedToken.revoked) {
      await this.refreshTokenRepo.update(
        { userId: storedToken.userId },
        { revoked: true },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const isMatch = this.hashToken(token) === storedToken.tokenHash;
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    let user: User;
    try {
      user = await this.userService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

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

    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as any,
      },
    );

    const hashedRefreshToken = this.hashToken(refreshToken);
    // Derive DB expiry from the token's own `exp` so the two can never diverge
    // regardless of JWT_REFRESH_EXPIRES_IN.
    const decoded = this.jwtService.decode(refreshToken) as {
      exp?: number;
    } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    return this.otpService.generate(
      userId,
      user.email,
      OtpPurpose.EMAIL_VERIFICATION,
    );
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

    // Wallet is normally created at registration; this is an idempotent
    // safety net for accounts created before that path, or where it failed.
    try {
      await this.creditsService.checkAndCreateWallet(user.id);
    } catch (e) {
      this.logger.error(
        'Failed to ensure wallet during email verification',
        e as Error,
      );
      // We don't throw here because email verification succeeded.
    }

    return { verified: true, message: 'Email verified successfully' };
  }
}
