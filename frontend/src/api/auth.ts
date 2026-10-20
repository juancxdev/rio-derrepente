import type { SessionResponse } from '../types';
import { apiJSON, apiNoContent } from './client';

export async function login(email: string, password: string): Promise<SessionResponse> {
  return apiJSON<SessionResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipUnauthorizedHandler: true,
  });
}

export async function fetchSession(): Promise<SessionResponse> {
  return apiJSON<SessionResponse>('/api/v1/auth/me');
}

export async function logout(): Promise<void> {
  await apiNoContent('/api/v1/auth/logout', { method: 'POST', skipUnauthorizedHandler: true });
}
