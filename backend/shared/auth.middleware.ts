import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthPayload } from './types';

export interface RequestWithUser extends Request {
  user?: AuthPayload;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: RequestWithUser, res: Response, next: NextFunction) {
    const requestPath = this.getRequestPath(req);
    if (this.isPublicRoute(requestPath)) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    try {
      const token = authHeader.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('Invalid token format');
      }

      if (!process.env.JWT_SECRET) {
        throw new UnauthorizedException('JWT secret is not configured');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as AuthPayload;
      req.user = decoded;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private getRequestPath(req: Request): string {
    const raw = (req as any).originalUrl || req.url || req.path || '';
    return raw.split('?')[0] || '';
  }

  private isPublicRoute(path: string): boolean {
    if (path === '/favicon.ico') return true;

    if (
      path.startsWith('/api/auth/') &&
      !path.startsWith('/api/auth/me') &&
      !path.startsWith('/api/auth/onboarding/complete') &&
      !path.startsWith('/api/auth/profile') &&
      !path.startsWith('/api/auth/settings')
    ) {
      return true;
    }

    const publicRoutes = [
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/registration',
      '/api/health',
      '/api/webhooks/contact-form/',
      '/api/webhooks/test/',
      '/api/webhooks/bounces',
      '/api/track/',
      '/api/unsubscribe/',
      '/api/inbound/',
      '/api/email/oauth/microsoft-callback',
      '/metrics',
    ];
    return publicRoutes.some(route => path.startsWith(route));
  }
}

// Workspace Isolation Middleware
@Injectable()
export class WorkspaceMiddleware implements NestMiddleware {
  use(req: RequestWithUser, res: Response, next: NextFunction) {
    if (!req.user) {
      return next();
    }

    // Store workspace context from JWT
    res.locals.workspaceId = req.user.workspaceId;
    res.locals.userId = req.user.userId;
    res.locals.role = req.user.role;

    next();
  }
}
