import { API_BASE_URL } from '@/constants/config';
import { ApiError, api, fetchWithTimeout } from '@/services/api';
import { getAuthToken } from '@/services/auth-token';
import type { HealthSummary } from '@/types';

// Time allowed to receive the response headers (i.e. for the stream to start).
// Once it is flowing, the caller's AbortSignal is the way to stop it.
const CHAT_START_TIMEOUT_MS = 30_000;

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
  // Failures throw ApiError so callers can use getErrorMessage().
  chatStream: async (petId: string, message: string, signal?: AbortSignal) => {
    const token = await getAuthToken();
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/pets/${petId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
        signal,
      },
      CHAT_START_TIMEOUT_MS,
    );
    if (!res.ok) {
      throw new ApiError(res.status, await res.text().catch(() => res.statusText));
    }
    if (!res.body) throw new ApiError(0, 'network');
    return res.body;
  },
};
