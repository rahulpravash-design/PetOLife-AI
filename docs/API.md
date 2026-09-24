# API reference

Base URL: `EXPO_PUBLIC_API_BASE_URL`. All bodies are JSON. Every endpoint except `/api/health` and the legacy `/api/auth/*` routes needs `Authorization: Bearer <Clerk session token>`.

Errors are `{ "error": "<message>" }`. Unexpected failures return a generic 500 with no internals.

| Status | Meaning |
|---|---|
| 400 | Validation failed (message says which field) |
| 401 | Missing, invalid or expired token |
| 404 | Not found **or not yours** |
| 413 | Document image too large (extract-document) |
| 429 | Per-user limit hit; `Retry-After` header gives seconds |
| 500 | Server error (generic message) |
| 501 | AI not configured on the server (extract-document only) |

## Endpoints

| Method + path | Purpose |
|---|---|
| `GET /api/health` | Liveness + DB connectivity (`{status, service, database:{connected}}`), 503 if the DB is down. No auth. |
| `GET /api/pets`, `POST /api/pets` | List / create pets |
| `GET, PATCH, DELETE /api/pets/:id` | Read / update / delete a pet (delete cascades to records and reminders) |
| `GET, POST /api/pets/:id/records` | List / create health records |
| `GET, PATCH, DELETE /api/pets/:id/records/:recordId` | Read / update / delete a record |
| `GET, POST /api/pets/:id/reminders` | List / create reminders |
| `PATCH, DELETE /api/pets/:id/reminders/:reminderId` | Update (incl. `isDone`) / delete a reminder |
| `GET /api/pets/:id/summary?from&to` | Deterministic facts + AI narration (with fallback). `from`/`to` must be valid dates. |
| `POST /api/pets/:id/chat` | Streams a plain-text answer. Body `{message}`. |
| `POST /api/pets/:id/extract-document` | Body `{imageBase64, mimeType}`. Returns a **draft** record; nothing is saved. |
| `POST /api/auth/signup`, `/login`, `/logout` | Legacy only; return 404 when `LEGACY_AUTH_ENABLED` is false. |

## Validation limits (`src/lib/validation.ts`)

| Field | Rule |
|---|---|
| pet `name`, `breed` | trimmed, 1-100 chars |
| record / reminder `title` | trimmed, 1-200 chars |
| `notes` | up to 2000 chars |
| `unit` | up to 32 chars |
| `type` | one of weight, vaccination, medication, vet_visit, symptom, lab_result, note |
| `species` | dog, cat, other |
| dates (`date`, `dueDate`, `birthDate`, `from`, `to`) | must parse as a real date, max 64 chars |
| `value` | finite number, -1,000,000 to 1,000,000 |
| `photoUrl`, `attachmentUrl` | `http(s)://` URL, max 2048 chars |
| chat `message` | trimmed, 1-2000 chars |
| `mimeType` | image/jpeg, png, webp, heic, heif |
| image | up to 10 MB decoded |

## Rate limits

Per user, fixed window, stored in the database (`rate_limit_state`). Defined in `src/lib/limits.ts` and the extract route.

| Feature | Limit |
|---|---|
| Chat | 30 requests / 10 min |
| Summary | 30 requests / 10 min |
| Document scan | 10 requests / 5 min |
| Legacy login | lockout with backoff after 5 failures per email (20 per IP) in 15 min |

Requests that fail validation do not use chat budget. Clerk sign-up and sign-in are rate limited by Clerk itself.

## Response headers

All `/api/*` responses carry `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Content-Security-Policy` and HSTS (`next.config.ts`). No CORS headers are sent; the only client is the native app.
