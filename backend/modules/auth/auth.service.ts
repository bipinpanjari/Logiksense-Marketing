import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { CreateUserDto, LoginUserDto, SignUpResponseDto } from '../../shared/types';
import { PrismaService } from '../../shared/prisma.service';
import { EmailValidationService } from './email-validation.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailValidation: EmailValidationService
  ) {}

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

      const result = await this.prisma.$transaction(async (tx) => {
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
          select: { id: true, email: true, firstName: true, lastName: true, onboardingCompleted: true },
        });

        const workspace = await tx.workspace.create({
          data: {
            customerId: user.id,
            name: `${firstName || 'New'}'s Workspace`,
          },
          select: { id: true, name: true },
        });

        return { user, workspace };
      });

      // Generate tokens
      const tokens = this.generateTokens(result.user.id, result.workspace.id, email, 'user');

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName || '',
          lastName: result.user.lastName || '',
          onboardingCompleted: result.user.onboardingCompleted,
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
      const user = await this.prisma.customer.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, passwordHash: true, firstName: true, lastName: true, onboardingCompleted: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get default workspace
      const workspace = await this.prisma.workspace.findFirst({
        where: { customerId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });

      if (!workspace) {
        throw new UnauthorizedException('No workspace found for this user');
      }

      // Generate tokens
      const tokens = this.generateTokens(user.id, workspace.id, user.email, 'user');

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          onboardingCompleted: user.onboardingCompleted,
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
      });

      const accessToken = this.jwtService.sign({
        userId: decoded.userId,
        workspaceId: decoded.workspaceId,
        email: decoded.email,
        role: decoded.role,
      }, {
        secret: accessSecret,
        expiresIn: accessExpiration,
      });

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
      select: { id: true, email: true, firstName: true, lastName: true, onboardingCompleted: true },
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
        updatedAt: true,
      },
    });
  }

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
    payload: { workspaceName?: string; timezone?: string; notifications?: Record<string, boolean> }
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
    };
    const nextSettings = JSON.parse(JSON.stringify(nextSettingsObject)) as Prisma.InputJsonValue;

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
    }
  ): Promise<{ success: boolean; onboardingCompleted: boolean; validation: { emailValid: boolean; dkimValid: boolean; spfValid: boolean } }> {
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
    if (!validation.emailValid) {
      throw new BadRequestException('Email domain validation failed. Please provide a valid work domain.');
    }

    await this.prisma.$transaction(async (tx) => {
      const [firstName, ...rest] = staffName.split(' ').filter(Boolean);
      const lastName = rest.join(' ');

      await tx.customer.update({
        where: { id: userId },
        data: {
          firstName: firstName || null,
          lastName: lastName || null,
          onboardingCompleted: true,
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
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      onboardingCompleted: true,
      validation: {
        emailValid: validation.emailValid,
        dkimValid: validation.dkimValid,
        spfValid: validation.spfValid,
      },
    };
  }
}
