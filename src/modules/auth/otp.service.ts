import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EmailOtp, OtpPurpose } from './entities/email-otp.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(EmailOtp)
    private otpRepo: Repository<EmailOtp>,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async generate(userId: string, email: string, purpose: OtpPurpose) {
    // Rate limiting: 60 seconds scoped to userId and purpose
    const mostRecentOtp = await this.otpRepo.findOne({
      where: { userId, purpose },
      order: { createdAt: 'DESC' },
    });

    if (mostRecentOtp) {
      const secondsSinceLast = (new Date().getTime() - mostRecentOtp.createdAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        throw new HttpException(
          { code: 'OTP_RATE_LIMITED', message: 'Please wait before requesting another code', retryAfterSeconds: Math.ceil(60 - secondsSinceLast) },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    
    const expiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    await this.otpRepo.save(
      this.otpRepo.create({
        userId,
        email,
        otp: hashedOtp,
        expiresAt,
        purpose,
      })
    );

    const sent = await this.mailService.sendOtpEmail(email, otp);
    if (!sent) {
      throw new BadRequestException('Failed to send OTP email');
    }

    return { message: 'OTP sent successfully', expiresAt };
  }

  async verify(userId: string, otp: string, purpose: OtpPurpose) {
    const record = await this.otpRepo.findOne({
      where: { userId, purpose, verifiedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'OTP expired or not found, request a new one' });
    }

    const isValid = await bcrypt.compare(otp, record.otp);
    if (!isValid) {
      record.attempts += 1;
      await this.otpRepo.save(record);
      
      const MAX_ATTEMPTS = 5;
      if (record.attempts >= MAX_ATTEMPTS) {
        throw new BadRequestException({ code: 'OTP_MAX_ATTEMPTS', message: 'Too many attempts, request a new OTP' });
      } else {
        throw new BadRequestException({ code: 'OTP_INVALID', message: 'Invalid OTP' });
      }
    }

    record.verifiedAt = new Date();
    await this.otpRepo.save(record);

    return { valid: true };
  }

  async cleanupExpiredOtp() {
    await this.otpRepo.delete({
      expiresAt: LessThan(new Date()),
      verifiedAt: IsNull(),
    });
  }
}
