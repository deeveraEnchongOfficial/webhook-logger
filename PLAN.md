# Webhook Logger — Implementation Plan

A webhook.site-style request inspector: receive any HTTP request on a unique URL,
log everything about it, store it safely in MongoDB, and inspect it in a UI with
JSON / table / raw views.

## 1. Tech Stack

| Layer    | Choice                                    | Why                                        |
| -------- | ----------------------------------------- | ------------------------------------------ |
| Framework| Next.js (App Router) + TypeScript         | API routes + UI in one app                 |
| Database | MongoDB via the official `mongodb` driver | Schema-flexible payloads, TTL indexes      |
| UI       | Tailwind CSS + shadcn/ui-style components | Fast, clean tables & detail panes          |
| JSON view| Custom JSON tree (no `eval`, no `dangerouslySetInnerHTML` with raw data) | XSS-safe |

## 2. Core Concept — "Bins"

- Each bin = a unique webhook URL: `https://<host>/hook/<binId>`
- `binId` is a cryptographically random token (`crypto.randomBytes(16).toString('hex')` — unguessable, so strangers can't read your captured requests)
- The same URL accepts **all** HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Creating a bin returns the URL to paste into the sender (GitHub, Stripe, a script, etc.)

## 3. Data Captured Per Request

- `method`, `path`, `query` params, `headers`, `ip`, `userAgent`
- `body`: raw text + parsed form (JSON / urlencoded / multipart text fields)
- `contentType`, `sizeBytes`, `receivedAt`, `durationMs`
- Response we returned (`status`, `body`) — bins can be configured to reply
  with a custom status/body later

### MongoDB collections

```ts
// bins
{ _id, token, name?, createdAt, requestCount, expiresAt? }

// requests (TTL index on receivedAt — auto-delete after N days)
{ _id, binId, method, path, query, headers, ip, userAgent,
  contentType, bodyRaw, bodyJson?, sizeBytes, receivedAt }
```

Indexes: `{ binId, receivedAt: -1 }`, TTL on `receivedAt`.

## 4. Security — Threat Model & Mitigations

This app ingests **arbitrary attacker-controlled input**, so the plan is explicit:

| Threat                          | Mitigation |
| ------------------------------- | ---------- |
| XSS via stored payloads in UI   | Never render body as HTML; JSON tree escapes everything; raw view is `<pre>`-escaped, `Content-Security-Policy` header |
| DoS — huge request bodies       | Hard cap on body read (e.g. 1 MB); truncate stored `bodyRaw` (e.g. 256 KB) |
| DoS — request flood             | Rate limit per IP on the hook endpoint (e.g. 120 req/min); cap requests per bin (e.g. 1,000 retained, LRU delete) |
| MongoDB operator injection      | Never pass client objects into queries unvalidated; `binId` validated as `^[a-f0-9]{32}$`; Mongoose/driver parameterized queries only |
| Prototype pollution in stored JSON | Reject/strip keys starting with `$` or containing `.` before insert (Mongo field-name rules) |
| Credential leakage              | Optional per-bin "redact sensitive headers" toggle (masks `authorization`, `cookie`, `x-api-key`) |
| Data retention / privacy        | TTL index (default 7 days, env-configurable); manual "clear bin" |
| Unauthorized bin access         | Bin token is the secret — unguessable; optional dashboard auth via env password later |
| Env/secret exposure             | `MONGODB_URI` server-only; never in client bundles |
| Security headers                | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict CSP |
| Slow-read attacks               | Body read timeout (e.g. 10 s) |

## 5. API Design

| Route                         | Methods | Purpose                          |
| ----------------------------- | ------- | -------------------------------- |
| `/hook/[binId]`               | ALL     | Capture endpoint (route handlers)|
| `/api/bins`                   | POST    | Create a bin → returns URL       |
| `/api/bins/[binId]/requests`  | GET     | List captured requests (paged)   |
| `/api/bins/[binId]/requests/[id]` | GET | Full request detail             |
| `/api/bins/[binId]/requests`  | DELETE  | Clear bin                        |

Hook route returns `200 { ok: true }` by default so senders are satisfied.

## 6. UI Design

- **Home** — "Create webhook bin" → shows generated URL with copy button
- **Bin view** `/b/[binId]` — split pane:
  - Left: request list — table (method badge, path, time, size), auto-refresh polling (3 s), filter by method, text search
  - Right: selected request detail —
    - **Overview**: method, URL, IP, timestamp, size
    - **Headers**: table view
    - **Query params**: table view
    - **Body**: tabs — `JSON tree` | `Table` (key/value for objects & form fields) | `Raw`
  - Actions: copy body, copy as cURL, delete request, clear bin

## 7. File Structure

```
webhook-logger/
  app/
    page.tsx                  # create bin
    b/[binId]/page.tsx        # inspector UI
    hook/[binId]/route.ts     # ALL-methods capture handler
    api/bins/route.ts         # POST create bin
    api/bins/[binId]/requests/route.ts   # GET list / DELETE clear
    api/bins/[binId]/requests/[id]/route.ts
  lib/
    db.ts                     # Mongo client + indexes
    capture.ts                # body-read w/ limits, sanitize keys
    ratelimit.ts              # in-memory token bucket (swap for Redis if deployed multi-instance)
    redact.ts                 # sensitive-header masking
  components/
    RequestTable.tsx, RequestDetail.tsx, JsonTree.tsx,
    KeyValueTable.tsx, MethodBadge.tsx
  PLAN.md
```

## 8. Implementation Order

1. Scaffold Next.js + TS + Tailwind (`create-next-app`)
2. `lib/db.ts` + env config + indexes
3. `/hook/[binId]` catch-all capture route with size limits, rate limiting, key sanitization
4. `/api/bins` CRUD
5. Home page + bin inspector page
6. View modes: JSON tree, key/value table, raw
7. Polling refresh, filters, cURL export
8. Security pass: CSP/security headers, redaction toggle, TTL index, input validation review
9. Tests: unit tests for capture/sanitize logic; manual curl matrix (JSON, form, empty, binary, oversized, flooded)

## 9. Env Vars

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=webhook_logger
BODY_LIMIT_BYTES=1048576
STORE_LIMIT_BYTES=262144
RATE_LIMIT_PER_MIN=120
RETENTION_DAYS=7
```

## 10. Known Limits / Future

- Rate limiter is in-memory (single instance) → Redis/Upstash for multi-instance deploys
- No websocket live push — polling only (SSE is a later upgrade)
- Binary bodies are stored truncated/base64-flagged, not fully viewable
