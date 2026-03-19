export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
  workspace?: AuthWorkspace;
}

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const WORKSPACE_KEY = 'workspace';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const value = localStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) : null;
}

export function getStoredWorkspace(): AuthWorkspace | null {
  const value = localStorage.getItem(WORKSPACE_KEY);
  return value ? JSON.parse(value) : null;
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);

  if (session.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }

  if (session.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  if (session.workspace) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(session.workspace));
  }
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
}
