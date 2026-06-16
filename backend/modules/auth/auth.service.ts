<<<<<<< Updated upstream
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
=======
import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { toDataURL } from 'qrcode';
>>>>>>> Stashed changes
import { Prisma } from '@prisma/client';
import { CreateUserDto, LoginUserDto, SignUpResponseDto } from '../../shared/types';
import { PrismaService } from '../../shared/prisma.service';
import { EmailValidationService } from './email-validation.service';
<<<<<<< Updated upstream

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailValidation: EmailValidationService
  ) {}
=======
import { VaultService } from '../../shared/vault.service';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailValidation: EmailValidationService,
    private vault: VaultService
  ) {
    this.fromEmail = process.env.SMTP_FROM || 'noreply@logik-sense.com';
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        } : undefined,
      });
    }
  }

  private async sendAuthEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      console.warn('SMTP not configured in .env, skipping email send');
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Failed to send auth email:', error);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.customer.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Don't leak user existence? Actually mostly we just return 200 anyway
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    await this.prisma.customer.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await this.sendAuthEmail(
      user.email,
      'Password Reset Request - LogikSense',
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2>Password Reset Request</h2>
        <p>Hi ${user.firstName || 'there'},</p>
        <p>You requested a password reset for your LogikSense account. Click the button below to set a new password:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">LogikSense Marketing Automation Suite</p>
      </div>
      `
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.prisma.customer.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.customer.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        // If MFA was causing friction or they forgot everything, we keep it enabled but they reset password
      },
    });
  }
>>>>>>> Stashed changes

  private resolveExpiry(value: string | undefined, fallback: SignOptions['expiresIn']): SignOptions['expiresIn'] {
    if (!value) return fallback;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : (value as SignOptions['expiresIn']);
  }

  async signup(createUserDto: CreateUserDto): Promise<SignUpResponseDto> {
    const email = (createUserDto.email || '').trim().toLowerCase();
    const password = createUserDto.password;
    const firstName = (createUserDto.firstName || '').trim();
    const lastName = (createUserDto.lastName || '').trim();

    try {
      // Check if user exists
      const existingUser = await this.prisma.customer.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException('User already exists with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

<<<<<<< Updated upstream
      const result = await this.prisma.$transaction(async (tx) => {
=======
      const result = await this.prisma.$transaction(async (tx: any) => {
>>>>>>> Stashed changes
        const user = await tx.customer.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            onboardingCompleted: false,
            planTier: 'starter',
            subscriptionStatus: 'trial',
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            onboardingCompleted: true,
            role: true,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            customerId: user.id,
            name: `${firstName || 'New'}'s Workspace`,
          },
          select: { id: true, name: true },
        });

<<<<<<< Updated upstream
=======
        // Add owner to members table
        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            customerId: user.id,
            role: 'owner',
          },
        });

>>>>>>> Stashed changes
        return { user, workspace };
      });

      const tokens = this.generateTokens(result.user.id, result.workspace.id, email, result.user.role);

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName || '',
          lastName: result.user.lastName || '',
          onboardingCompleted: result.user.onboardingCompleted,
<<<<<<< Updated upstream
=======
          twoFactorEnabled: false,
>>>>>>> Stashed changes
        },
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
        },
        tokens,
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<SignUpResponseDto> {
    const email = (loginUserDto.email || '').trim().toLowerCase();
    const password = loginUserDto.password;

    try {
      // Find user
<<<<<<< Updated upstream
=======
      console.log(`DEBUG: Login attempt for email: "${email}"`);
>>>>>>> Stashed changes
      const user = await this.prisma.customer.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          firstName: true,
          lastName: true,
          onboardingCompleted: true,
          role: true,
<<<<<<< Updated upstream
=======
          twoFactorEnabled: true,
          twoFactorSecret: true,
>>>>>>> Stashed changes
        },
      });

      if (!user) {
<<<<<<< Updated upstream
=======
        console.log(`DEBUG: User not found for email: "${email}"`);
>>>>>>> Stashed changes
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
<<<<<<< Updated upstream
=======
      console.log(`DEBUG: Password valid for "${email}": ${isPasswordValid}`);
>>>>>>> Stashed changes
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

<<<<<<< Updated upstream
=======
      // Handle MFA
      if (user.twoFactorEnabled) {
        const mfaPayload = { userId: user.id, email: user.email, sub: 'mfa' };
        const tempToken = this.jwtService.sign(mfaPayload, {
          secret: process.env.JWT_SECRET,
          expiresIn: '5m',
        });
        
        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            onboardingCompleted: user.onboardingCompleted,
            twoFactorEnabled: true,
          },
          workspace: { id: '', name: '' },
          mfaRequired: true,
          tempToken,
        };
      }

>>>>>>> Stashed changes
      // Get default workspace
      const workspace = await this.prisma.workspace.findFirst({
        where: { customerId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });

      if (!workspace) {
        throw new UnauthorizedException('No workspace found for this user');
      }

      const tokens = this.generateTokens(user.id, workspace.id, user.email, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          onboardingCompleted: user.onboardingCompleted,
<<<<<<< Updated upstream
=======
          twoFactorEnabled: false,
>>>>>>> Stashed changes
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        tokens,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      const accessSecret = process.env.JWT_SECRET;
      const accessExpiration = this.resolveExpiry(process.env.JWT_EXPIRATION, '1d');

      if (!refreshSecret || !accessSecret) {
        throw new UnauthorizedException('JWT secrets are not configured');
      }

      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      }) as { userId?: string; workspaceId?: string; email?: string; role?: string };

      const fresh = await this.prisma.customer.findUnique({
        where: { id: decoded.userId as string },
        select: { role: true },
      });
      const role = fresh?.role ?? decoded.role ?? 'member';

      const accessToken = this.jwtService.sign(
        {
          userId: decoded.userId,
          workspaceId: decoded.workspaceId,
          email: decoded.email,
          role,
        },
        {
          secret: accessSecret,
          expiresIn: accessExpiration,
        },
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(userId: string, workspaceId: string, email: string, role: string) {
    const accessSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    const accessExpiration = this.resolveExpiry(process.env.JWT_EXPIRATION, '1d');
    const refreshExpiration = this.resolveExpiry(process.env.JWT_REFRESH_EXPIRATION, '7d');

    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const payload = { userId, workspaceId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiration,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiration,
    });

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
<<<<<<< Updated upstream
      select: { id: true, email: true, firstName: true, lastName: true, onboardingCompleted: true },
=======
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true, 
        onboardingCompleted: true,
        twoFactorEnabled: true,
      },
>>>>>>> Stashed changes
    });
    return user || null;
  }

  async getWorkspaceById(workspaceId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.customer.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        onboardingCompleted: true,
<<<<<<< Updated upstream
=======
        twoFactorEnabled: true,
>>>>>>> Stashed changes
        createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, payload: { firstName?: string; lastName?: string; email?: string }) {
    const nextEmail = payload.email?.trim().toLowerCase();
    if (nextEmail) {
      const existing = await this.prisma.customer.findFirst({
        where: { id: { not: userId }, email: { equals: nextEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Email already in use by another account');
      }
    }

    return this.prisma.customer.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName?.trim(),
        lastName: payload.lastName?.trim(),
        ...(nextEmail ? { email: nextEmail } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        onboardingCompleted: true,
<<<<<<< Updated upstream
=======
        twoFactorEnabled: true,
>>>>>>> Stashed changes
        updatedAt: true,
      },
    });
  }

<<<<<<< Updated upstream
=======
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.customer.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Password changed successfully' };
  }

>>>>>>> Stashed changes
  async getWorkspaceSettings(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, customerId: userId },
      select: { id: true, name: true, settings: true },
    });
    if (!workspace) {
      throw new UnauthorizedException('Workspace not found for this account');
    }
    return workspace;
  }

  async updateWorkspaceSettings(
    userId: string,
    workspaceId: string,
<<<<<<< Updated upstream
    payload: { workspaceName?: string; timezone?: string; notifications?: Record<string, boolean> }
=======
    payload: { 
      workspaceName?: string; 
      timezone?: string; 
      notifications?: Record<string, boolean>;
      scraper?: Record<string, any>;
    }
>>>>>>> Stashed changes
  ) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, customerId: userId },
      select: { id: true, name: true, settings: true },
    });
    if (!workspace) {
      throw new UnauthorizedException('Workspace not found for this account');
    }

    const currentSettings =
      workspace.settings && typeof workspace.settings === 'object' && !Array.isArray(workspace.settings)
        ? (workspace.settings as Record<string, unknown>)
        : {};

    if (payload.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: payload.timezone }).format(new Date());
      } catch {
        throw new BadRequestException('Invalid timezone identifier');
      }
    }

    const nextSettingsObject: Record<string, unknown> = {
      ...currentSettings,
      preferences: {
        ...(typeof currentSettings.preferences === 'object' && currentSettings.preferences ? (currentSettings.preferences as Record<string, unknown>) : {}),
        ...(payload.timezone ? { timezone: payload.timezone } : {}),
      },
      notifications: {
        ...(typeof currentSettings.notifications === 'object' && currentSettings.notifications ? (currentSettings.notifications as Record<string, unknown>) : {}),
        ...(payload.notifications || {}),
      },
<<<<<<< Updated upstream
    };
    const nextSettings = JSON.parse(JSON.stringify(nextSettingsObject)) as Prisma.InputJsonValue;
=======
      scraper: {
        ...(typeof currentSettings.scraper === 'object' && currentSettings.scraper ? (currentSettings.scraper as Record<string, unknown>) : {}),
        ...(payload.scraper || {}),
      },
    };
    const nextSettings = JSON.parse(JSON.stringify(nextSettingsObject)) as any;
>>>>>>> Stashed changes

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(payload.workspaceName ? { name: payload.workspaceName.trim() } : {}),
        settings: nextSettings,
      },
      select: { id: true, name: true, settings: true, updatedAt: true },
    });
  }

  async completeOnboarding(
    userId: string,
    workspaceId: string,
    payload: {
      companyName: string;
      staffName: string;
      numberOfEmployees: number;
      workEmail: string;
      sendingEmail: string;
      domain: string;
      dkimSelector?: string;
      skipDnsValidation?: boolean;
<<<<<<< Updated upstream
=======
      termsAccepted?: boolean;
>>>>>>> Stashed changes
    }
  ): Promise<{
    success: boolean;
    onboardingCompleted: boolean;
    validationSkipped: boolean;
    validation: { emailValid: boolean; dkimValid: boolean; spfValid: boolean };
  }> {
    const companyName = payload.companyName.trim();
    const staffName = payload.staffName.trim();
    const workEmail = payload.workEmail.trim().toLowerCase();
    const sendingEmail = payload.sendingEmail.trim().toLowerCase();
    const domain = payload.domain.trim().toLowerCase();
    const dkimSelector = (payload.dkimSelector || 'logik').trim();

    const sendingEmailDomain = sendingEmail.split('@')[1] || '';
    if (sendingEmailDomain !== domain) {
      throw new BadRequestException('Sending email domain must match the provided domain');
    }

    const validation = await this.emailValidation.validateOutboundEmail(sendingEmail, domain);
    const serverSkipsDns = process.env.ONBOARDING_SKIP_DNS_VALIDATION === 'true';
    const clientSkipAllowed =
      process.env.NODE_ENV !== 'production' || process.env.ONBOARDING_ALLOW_CLIENT_DNS_SKIP === 'true';
    const skipDns = serverSkipsDns || (payload.skipDnsValidation === true && clientSkipAllowed);

    if (!validation.emailValid && !skipDns) {
      if (payload.skipDnsValidation && !clientSkipAllowed) {
        throw new BadRequestException(
          'DNS/MX checks failed and skipping validation is not enabled for this environment. Set ONBOARDING_ALLOW_CLIENT_DNS_SKIP=true on the server, or point MX/DNS for your domain.',
        );
      }
      throw new BadRequestException('Email domain validation failed. Please provide a valid work domain.');
    }

<<<<<<< Updated upstream
    await this.prisma.$transaction(async (tx) => {
=======
    await this.prisma.$transaction(async (tx: any) => {
>>>>>>> Stashed changes
      const [firstName, ...rest] = staffName.split(' ').filter(Boolean);
      const lastName = rest.join(' ');

      await tx.customer.update({
        where: { id: userId },
        data: {
          firstName: firstName || null,
          lastName: lastName || null,
          onboardingCompleted: true,
<<<<<<< Updated upstream
=======
          termsAccepted: payload.termsAccepted ?? false,
          termsAcceptedAt: payload.termsAccepted ? new Date() : null,
>>>>>>> Stashed changes
        },
      });

      const existingCompany = await tx.company.findFirst({
        where: { customerId: userId },
        select: { id: true },
      });

      if (existingCompany) {
        await tx.company.update({
          where: { id: existingCompany.id },
          data: {
            name: companyName,
            numberOfEmployees: payload.numberOfEmployees,
            domain: workEmail.split('@')[1] || domain,
          },
        });
      } else {
        await tx.company.create({
          data: {
            customerId: userId,
            name: companyName,
            numberOfEmployees: payload.numberOfEmployees,
            domain: workEmail.split('@')[1] || domain,
          },
        });
      }

      await tx.emailConfig.upsert({
        where: {
          customerId_sendingEmail: {
            customerId: userId,
            sendingEmail,
          },
        },
        update: {
          workspaceId,
          domain,
          dkimSelector,
          dkimValid: validation.dkimValid,
          spfValid: validation.spfValid,
          lastValidated: new Date(),
          isActive: true,
        },
        create: {
          customerId: userId,
          workspaceId,
          sendingEmail,
          domain,
          dkimSelector,
          dkimValid: validation.dkimValid,
          spfValid: validation.spfValid,
          lastValidated: new Date(),
          isActive: true,
        },
      });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          name: `${companyName} Workspace`,
          settings: {
            onboarding: {
              completedAt: new Date().toISOString(),
              companyName,
              staffName,
              numberOfEmployees: payload.numberOfEmployees,
              workEmail,
              sendingEmail,
              domain,
              dkimSelector,
              validation: {
                emailValid: validation.emailValid,
                dkimValid: validation.dkimValid,
                spfValid: validation.spfValid,
                skipped: !validation.emailValid && skipDns,
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      onboardingCompleted: true,
      validationSkipped: !validation.emailValid && skipDns,
      validation: {
        emailValid: validation.emailValid,
        dkimValid: validation.dkimValid,
        spfValid: validation.spfValid,
      },
    };
  }
<<<<<<< Updated upstream
=======

  // ==================== 2FA / MFA ====================

  async generateTwoFactorSecret(userId: string) {
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'LogikMarket',
      label: user.email,
      secret,
    });
    const qrCode = await toDataURL(otpauthUrl);

    // Store encrypted secret temporarily but don't enable yet
    const encryptedSecret = this.vault.encrypt(secret);
    await this.prisma.customer.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    return { secret, qrCode };
  }

  async verifyTwoFactorCode(userId: string, code: string) {
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, recoveryCodes: true },
    });

    if (!user?.twoFactorSecret) {
      throw new BadRequestException('2FA not initialized');
    }

    // Check TOTP code
    const secret = this.vault.decrypt(user.twoFactorSecret);
    const { valid: isValid } = verifySync({
      token: code.trim(),
      secret,
    });

    if (isValid) return true;

    // Check recovery codes if 6-digit TOTP fails
    if (user.recoveryCodes) {
      const codes: string[] = JSON.parse(user.recoveryCodes);
      const matchedIndex = codes.findIndex((c: string) => bcrypt.compareSync(code.trim(), c));
      
      if (matchedIndex !== -1) {
        // Remove used recovery code
        codes.splice(matchedIndex, 1);
        await this.prisma.customer.update({
          where: { id: userId },
          data: { recoveryCodes: JSON.stringify(codes) },
        });
        return true;
      }
    }

    throw new UnauthorizedException('Invalid authenticator code');
  }

  async enableTwoFactor(userId: string, code: string) {
    await this.verifyTwoFactorCode(userId, code);

    // Generate 10 recovery codes
    const rawCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedCodes = rawCodes.map(c => bcrypt.hashSync(c, 10));

    await this.prisma.customer.update({
      where: { id: userId },
      data: { 
        twoFactorEnabled: true,
        recoveryCodes: JSON.stringify(hashedCodes)
      },
    });

    return { success: true, recoveryCodes: rawCodes };
  }

  async disableTwoFactor(userId: string, code: string) {
    await this.verifyTwoFactorCode(userId, code);
    await this.prisma.customer.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { success: true };
  }

  /**
   * Complete login after MFA code verification
   */
  async loginWithMfa(tempToken: string, code: string): Promise<SignUpResponseDto> {
    try {
      const decoded = this.jwtService.verify(tempToken, {
        secret: process.env.JWT_SECRET,
      }) as { userId: string };

      await this.verifyTwoFactorCode(decoded.userId, code);

      const user = await this.prisma.customer.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          onboardingCompleted: true,
          role: true,
        },
      });

      if (!user) throw new UnauthorizedException();

      const workspace = await this.prisma.workspace.findFirst({
        where: { customerId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });

      if (!workspace) throw new UnauthorizedException('No workspace found');

      const tokens = this.generateTokens(user.id, workspace.id, user.email, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          onboardingCompleted: user.onboardingCompleted,
          twoFactorEnabled: true,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        tokens,
      };
    } catch (e) {
      throw new UnauthorizedException('MFA verification failed');
    }
  }
>>>>>>> Stashed changes
}
