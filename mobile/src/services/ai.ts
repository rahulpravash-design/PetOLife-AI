import { API_BASE_URL } from '@/constants/config';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth-store';
import type { HealthSummary } from '@/types';

export const aiService = {
  getSummary: (petId: string, rangeStart?: string, rangeEnd?: string) => {
    const params = new URLSearchParams();
    if (rangeStart) params.set('from', rangeStart);
    if (rangeEnd) params.set('to', rangeEnd);
    const qs = params.toString();
    return api.get<HealthSummary>(`/api/pets/${petId}/summary${qs ? `?${qs}` : ''}`);
  },

  // Streaming chat: caller consumes the ReadableStream directly (fetch-based,
  // since React Native's XHR-backed fetch does not support EventSource).
  chatStream: async (petId: string, message: string, signal?: AbortSignal) => {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_BASE_URL}/api/pets/${petId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Chat request failed: ${res.status}`);
    }
    return res.body;
  },
};
