import { ApiError } from '@/services/api';

// Turns anything thrown by the API layer into a message that is safe to show
// to a user: never a stack trace, raw server text or Clerk/internal detail.
// The only server text ever shown is the `error` field of a 400 response,
// which the backend writes for users (e.g. "Title is required").
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(err instanceof ApiError)) return fallback;

  switch (true) {
    case err.status === 0:
      return err.message === 'timeout'
        ? 'The request took too long. Check your connection and try again.'
        : "Can't reach the server. Check your connection and try again.";
    case err.status === 400:
      return serverMessage(err.message) ?? 'Please check the information you entered.';
    case err.status === 401:
      return 'Your session has expired. Please sign out and sign in again.';
    case err.status === 403:
      return "You don't have permission to do that.";
    case err.status === 404:
      return 'That item could not be found. It may have been deleted.';
    case err.status === 413:
      return 'That file is too large.';
    case err.status === 429:
      return 'Too many requests. Please wait a few minutes and try again.';
    case err.status >= 500:
      return 'Something went wrong on our side. Please try again shortly.';
    default:
      return fallback;
  }
}

function serverMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed.error === 'string' && parsed.error.length <= 200 ? parsed.error : null;
  } catch {
    return null;
  }
}
