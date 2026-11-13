# QueueFlow architecture

## Request and package flow

The npm workspaces monorepo separates presentation, transport, domain behavior and persistence while sharing one source of truth for request/data shapes:

```text
Browser (Next App Router)
  ├─ same-origin /api/* ─ Express routes → auth/ownership/Zod middleware → domain services → Mongoose → MongoDB
  ├─ same-origin /socket.io → authorized owner/queue/public rooms → safe update notifications
  └─ pages/app assets ← custom Node server → Next.js App Router rendering
```

`backend/src/server.ts` owns the single preview listener (`PORT`, default 3000); Express routes are mounted before the Next handler. This supports the managed cross-site Preview proxy, same-origin browser calls/cookies and WebSocket upgrades without an internal-host-derived URL. The code also accepts browser-safe `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` for split hosting. `frontend/` contains landing/auth/dashboard/queue/analytics/settings/public-display routes, hooks, API transport and visual components. `packages/shared/` exports client-safe Zod schemas/types. No manager-session user is fabricated in local or Preview mode.

## Persistence and indexes

- **Manager**: normalized unique `email`, `name`, `passwordHash` excluded by default and timestamps. The bcrypt hash is only selected for credential verification.
- **Queue**: `managerId`, name/description, unique random public ID, `active|paused|closed` status, atomic `tokenCounter`, `servingTokenId`, and a short-lived cross-process reorder lease. Manager/status/creation indexes support owner listings.
- **Token**: queue and per-queue integer token number, person name and select-false optional phone, `waiting|serving|completed|cancelled` status, waiting `position`, and creation/call/service-start/completion/cancellation times. The supported API also accepts the historical `called` status. Indexes include unique `{queueId,tokenNumber}`, partial unique `{queueId,position}` for `waiting`, status/position listing and lifecycle timestamp lookups.
- **Activity**: manager, queue, optional token, enumerated action, non-sensitive description and `occurredAt`; manager/queue time indexes support recent activity and trends.

MongoDB URI is injected at runtime and is not needed at compile time. On successful connection, the startup service explicitly creates indexes. Use MongoDB Atlas or a local replica-capable/community server as appropriate. Integration tests start their own in-memory MongoDB, and never use the URI configured for the application.

## Service and concurrency invariants

1. Every manager queue/token route resolves the queue under `managerId`; a missing or foreign queue/token returns the same not-found behavior.
2. A queue lease serializes changes that assign sequence numbers or rewrite waiting positions across multiple processes. The lease expires if a process stops; all claim/release operations condition on its generated ID.
3. Token number allocation atomically increments `Queue.tokenCounter` and is backed by a unique index. A position's waiting-only unique index plus two-phase temporary-position renumber prevents intermediate unique-index collisions. Reorders target only waiting rows and normalize the line to zero-based contiguous positions.
4. Call Next requires an active queue and empty service slot, claims the queue pointer with a conditional update, and then atomically changes the earliest waiting token to serving. Callers cannot claim an already claimed service. Completion conditionally transitions the service token to completed, records time and releases the queue pointer. Cancellation applies only to a waiting token and records its time.
5. Public responses and socket payloads use reduced DTOs; they never serialize token model phone fields, manager-written free-form queue descriptions or manager/account/session data. Reconnected clients reload the REST source of truth.

The order lease serializes multi-document transitions, but the steps are not one Mongo transaction. After an interruption, the next leased operation detects and compacts noncontiguous waiting positions. Call Next also reconciles the service pointer against its token: an active `called`/`serving` token keeps the slot, a still-waiting token can be reclaimed, and a missing or terminal token clears the stale pointer. The lease expires after a process stop; recovery runs on the next manager mutation rather than requiring a manual repair. Unique indexes preserve hard uniqueness constraints.

## Sessions, HTTP and socket security

Managers use password-validated registration/login (bcrypt), a signed HS256 JWT with a seven-day expiry, and the application-owned `queueflow_session` HTTP-only cookie. It does not reuse platform-owned `app_session_id` or `webdev_app_session`. `COOKIE_SECURE=true` sets Secure/SameSite=None for public HTTPS Preview and deployments even if the proxy-to-Node hop is HTTP. `COOKIE_SECURE=false` is only for plain-HTTP local development. `queueflow_csrf` is a separate browser-readable double-submit token; every mutation checks header/cookie equality. All auth endpoints are rate-limited. Security middleware also applies Helmet, credentialed exact-origin CORS, request-size limits, Zod validation and centralized errors.

Set a unique random `JWT_SECRET` (32+ characters), and protect Mongo/JWT/cookie values in a deployment secret store. Do not use Node's `NODE_ENV` or Express `req.secure` to decide Preview cookie attributes. Browser third-party-cookie restrictions may still block cookies in cross-site iframes; a stable HTTPS site and appropriate host placement are recommended.

Socket.IO uses session cookies for manager connections; `queue:join` checks the requested queue against database ownership before joining. Public connections provide a public queue identifier whose existence is validated. Safe event payloads omit phone/name data. The REST endpoints and MongoDB remain authoritative.

## Analytics definitions

- **Token total / arrivals**: token `createdAt` inside the selected period.
- **Current waiting / serving**: live status counts irrespective of creation date. A queue accepts tokens/call-next only while active.
- **Completions**: completed token `completedAt` in the period. **Cancellations**: `cancelledAt` in the period.
- **Wait**: `serviceStartedAt - createdAt`; wait samples are grouped by service-start time. A zero-duration measurement is different from no matching samples (`null`).
- **Service duration**: `completedAt - serviceStartedAt`; only completed records with real start and end contribute.
- **Waiting-line trend**: reconstruct line end count from records waiting at period start, then add created tokens and subtract service-start/cancellation events by day.
- **Peak hour**: actual token creation counts grouped into 24 local-hour bins using the browser-supplied IANA time zone; API callers without a time zone default to UTC. Daily arrival/completion/wait buckets and displayed calendar labels use that same local time zone, including daylight-saving boundaries.
- **Queue utilization**: no per-queue capacity model exists, so the product reports waiting tokens per active queue, not percent full.
- **Public estimate**: completed-service mean multiplied by the waiting tokens ahead, adjusted for remaining time on an active service; `null` when no real sample exists.

## Development, tests and operational boundaries

Use `npm ci`, create `.env` from `.env.example`, configure local/Atlas MongoDB and run `npm run dev`. A missing URI leaves the Next shell available and returns 503 from data-backed REST routes; it never invents metrics. The optional seed is an explicit development command and refuses production. API integration tests use `mongodb-memory-server-core` with an isolated temporary database, which is not the managed/production Atlas store.

Build with `npm run build`; the root server starts the compiled backend plus the production Next artifact with `npm start`. `GET /api/health` is an unauthenticated readiness probe (200 only when the DB is connected); the process handles SIGTERM/SIGINT and disconnects MongoDB. Production container disk is not treated as durable storage.

### Unified production

One Node host/container serves Next pages, Express REST and Socket.IO through a single HTTPS origin. Set `PORT`, Atlas `MONGODB_URI`, `JWT_SECRET`, `COOKIE_SECURE=true`, `FRONTEND_URL`, `NODE_ENV=production`; expose `/api/health` to a load balancer. Database/JWT secrets are runtime-only and not included in the build.

### Split production

Vercel can host the frontend bundle while Render/AWS runs the Express/Next/Socket.IO Node service. Set frontend build-time `NEXT_PUBLIC_API_URL` to the API `/api` base and optional `NEXT_PUBLIC_SOCKET_URL` to the socket origin. Set the server `FRONTEND_URL` to the precise Vercel app origin and enable credentialed CORS; use HTTPS for both. Use a stable site/API DNS arrangement and validate cross-origin `SameSite=None; Secure` cookies, CSRF and WebSocket transport in the real browser. Ensure host timeouts, proxies and scaling preserve WebSocket upgrades and long-poll fallback.
