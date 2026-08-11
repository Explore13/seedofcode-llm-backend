import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(private configService: ConfigService) {
    this.from = this.configService.get<string>(
      'SMTP_FROM',
      'noreply@seedofcode.dev',
    );
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: Number(this.configService.get('SMTP_PORT')) === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.from,
        to,
        subject: 'Your SeedOfCode Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Verification Code</h2>
            <p>Your one-time verification code is:</p>
            <h1 style="color: #007bff; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in ${this.configService.get<number>('OTP_EXPIRY_MINUTES', 5)} minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${to}`,
        (error as Error).stack,
      );
      return false;
    }
  }
}
