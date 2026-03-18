import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { getDatabase } from '../../shared/database';
import { CreateUserDto, LoginUserDto, SignUpResponseDto } from '../../shared/types';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async signup(createUserDto: CreateUserDto): Promise<SignUpResponseDto> {
    const { email, password, firstName, lastName } = createUserDto;
    const db = getDatabase();

    try {
      // Check if user exists
      const existingUser = await db.query('SELECT id FROM customers WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new ConflictException('User already exists with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create customer
      const userResult = await db.query(
        `INSERT INTO customers (email, password_hash, first_name, last_name, plan_tier, subscription_status)
         VALUES ($1, $2, $3, $4, 'starter', 'trial')
         RETURNING id, email, first_name, last_name`,
        [email, passwordHash, firstName, lastName]
      );

      const user = userResult.rows[0];
      const customerId = user.id;

      // Create default workspace
      const workspaceResult = await db.query(
        `INSERT INTO workspaces (customer_id, name)
         VALUES ($1, $2)
         RETURNING id, name`,
        [customerId, `${firstName}'s Workspace`]
      );

      const workspace = workspaceResult.rows[0];

      // Generate tokens
      const tokens = this.generateTokens(customerId, workspace.id, email, 'user');

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        tokens,
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<SignUpResponseDto> {
    const { email, password } = loginUserDto;
    const db = getDatabase();

    try {
      // Find user
      const userResult = await db.query(
        'SELECT id, email, password_hash, first_name, last_name FROM customers WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get default workspace
      const workspaceResult = await db.query(
        'SELECT id, name FROM workspaces WHERE customer_id = $1 ORDER BY created_at LIMIT 1',
        [user.id]
      );

      if (workspaceResult.rows.length === 0) {
        throw new UnauthorizedException('No workspace found for this user');
      }

      const workspace = workspaceResult.rows[0];

      // Generate tokens
      const tokens = this.generateTokens(user.id, workspace.id, user.email, 'user');

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
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
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const accessToken = this.jwtService.sign({
        userId: decoded.userId,
        workspaceId: decoded.workspaceId,
        email: decoded.email,
        role: decoded.role,
      });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(userId: string, workspaceId: string, email: string, role: string) {
    const payload = { userId, workspaceId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT id, email, first_name, last_name FROM customers WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }
}
