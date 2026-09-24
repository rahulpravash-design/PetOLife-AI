// Per-user budgets for the endpoints that call a paid model. Kept out of the
// route files because Next.js route modules may only export HTTP handlers.
// Each budget is a fixed window enforced by enforceUserThrottle().

export const CHAT_THROTTLE_LIMIT = 30;
export const CHAT_THROTTLE_WINDOW_MS = 10 * 60 * 1000;

export const SUMMARY_THROTTLE_LIMIT = 30;
export const SUMMARY_THROTTLE_WINDOW_MS = 10 * 60 * 1000;
