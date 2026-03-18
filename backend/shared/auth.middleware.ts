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
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // Allow unauthenticated access to public routes
      if (this.isPublicRoute(req.path)) {
        return next();
      }
      throw new UnauthorizedException('Missing authorization header');
    }

    try {
      const token = authHeader.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('Invalid token format');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret') as AuthPayload;
      req.user = decoded;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = ['/api/auth/signup', '/api/auth/login', '/api/health', '/api/auth/refresh'];
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
