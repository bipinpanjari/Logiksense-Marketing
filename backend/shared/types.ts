import { JwtPayload } from 'jsonwebtoken';

export interface AuthPayload extends JwtPayload {
  userId: string;
  workspaceId: string;
  email: string;
  role: 'user' | 'admin';
}

export interface RequestWithUser {
  user?: AuthPayload;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface SignUpResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    onboardingCompleted: boolean;
    twoFactorEnabled?: boolean;
  };
  workspace?: {
    id: string;
    name: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  mfaRequired?: boolean;
  tempToken?: string;
}

export interface PaginationDto {
  page: number;
  limit: number;
  skip: number;
}
