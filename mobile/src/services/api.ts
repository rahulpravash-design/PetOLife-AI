import { API_BASE_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth-token';

// status 0 means the request never got an HTTP response: `message` is
// 'timeout' when we gave up waiting, 'network' for everything else (offline,
// DNS failure, server down). Use getErrorMessage() from services/errors to
// turn any ApiError into user-facing text.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Without a timeout a stalled connection leaves the screen loading forever.
export const REQUEST_TIMEOUT_MS = 20_000;

// fetch() that maps transport failures to ApiError(0, ...). An optional caller
// signal (e.g. cancelling a chat on unmount) is honoured alongside the timeout.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // A caller-initiated abort is not an error to report as network trouble.
    if (callerSignal?.aborted && !timedOut) throw err;
    throw new ApiError(0, timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const jsonBody = (body: unknown) => (body === undefined ? undefined : JSON.stringify(body));

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: jsonBody(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: jsonBody(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
