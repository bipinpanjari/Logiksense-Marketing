import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, LoginUserDto, SignUpResponseDto } from '../../shared/types';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService
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
            planTier: 'starter',
            subscriptionStatus: 'trial',
          },
          select: { id: true, email: true, firstName: true, lastName: true },
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
        select: { id: true, email: true, passwordHash: true, firstName: true, lastName: true },
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
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return user || null;
  }
}
