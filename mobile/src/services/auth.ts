import { api } from '@/services/api';
import type { User } from '@/types';

interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),

  signup: (email: string, password: string, name: string) =>
    api.post<AuthResponse>('/api/auth/signup', { email, password, name }),

  logout: () => api.post<void>('/api/auth/logout'),
};
