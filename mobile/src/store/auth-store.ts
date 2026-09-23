import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { User } from '@/types';

const TOKEN_KEY = 'petolife_auth_token';

interface AuthState {
  token: string | null;
  user: User | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrated: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    set({ token, isHydrated: true });
  },

  signIn: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));
