import { clearSession, getAccessToken, getRefreshToken, setSession } from './storage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const data = await response.json();
    if (!data?.accessToken) {
      clearSession();
      return null;
    }

    setSession({ accessToken: data.accessToken });
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = getAccessToken();
  if (accessToken) return accessToken;
  return refreshAccessToken();
}
