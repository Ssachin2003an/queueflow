# QueueFlow implementation plan

## Product and implementation approach

QueueFlow is a full-stack queue-management SaaS for managers who create service queues, add and prioritize visitors, call and complete service, and monitor real operational analytics. It also provides a read-only public display for large screens. The implementation follows the supplied assignment and master prompt rather than replacing behavior with mock data.

The requested split architecture lives in an npm-workspaces monorepo. `frontend` contains the Next.js App Router/TypeScript application, UI, client hooks and API client. `backend` contains the Express/TypeScript REST API, Mongoose models, authentication, business services, Socket.IO and optional seed tooling. `packages/shared` holds shared validation contracts and client-safe types. For the managed Preview and single-origin cookie/session behavior, the backend's Node entry point mounts Express APIs and Socket.IO on the configured port and delegates page requests to Next.js App Router; this keeps source responsibilities separate while the browser uses same-origin relative `/api` and `/socket.io` paths by default. Development runs Next in dev mode through this entry point; production builds Next and starts the same server. An optional browser-safe API/socket origin supports a separately hosted frontend/API. REST remains the source of truth; Socket.IO distributes authorized state changes.

MongoDB/Mongoose uses `MONGODB_URI` from the protected project runtime and supports Atlas TLS settings. The project deliberately does not enable the platform's managed MySQL database, because the user explicitly asked for MongoDB Atlas. The user has supplied the Atlas URI and JWT signing secret through protected project input; values are never copied into source, environment examples or logs. API integration tests use only an isolated in-memory MongoDB and do not touch the supplied Atlas database. Authentication is the explicitly requested manager registration/login using bcrypt and a signed JWT in a distinct HTTP-only cookie; it is not replaced by a third-party identity provider. HTTPS Preview/deployed cookies must be eligible in a cross-site iframe (`SameSite=None; Secure`), while local HTTP has an explicitly configured cookie setting. Protect cookie-authenticated state-changing requests against CSRF.

Core entities are Manager, Queue, Token, and Activity. Enforce ownership on every manager queue/token/analytics operation. Generate per-queue token numbers with an atomic queue counter and a unique `(queueId, tokenNumber)` index. Use conditional atomic updates for claiming the next token and a cross-process queue-order lease plus a partial unique position index and two-phase renumbering strategy for consistent waiting positions. Persist lifecycle timestamps; compute analytics from records instead of illustrative constants. Public APIs and socket events omit private contact information and manager-only data.

## Main project structure

```text
queueflow/
├── frontend/
│   ├── app/                   # App Router routes, root/dashboard layouts, global theme and route manifest
│   ├── components/            # Brand, shell, forms, queue UI, charts, dialogs, cursor and UI primitives
│   ├── hooks/                 # Application auth and queue Socket.IO subscriptions
│   ├── lib/                   # Same-origin API client, date analytics and formatting helpers
│   ├── tests/                 # React/form/date-filter tests
│   └── public/                # Favicon/brand icon and static assets
├── backend/
│   ├── src/config/runtime.ts  # Validated environment, Mongo connection and index bootstrap
│   ├── src/middleware/core.ts # Request validation, JWT session middleware and HTTP errors
│   ├── src/models/index.ts    # Mongoose Manager, Queue, Token and Activity schemas/indexes
│   ├── src/services/domain.ts # Auth, ownership-aware queue/token and database-backed analytics logic
│   ├── src/server.ts          # Express REST routes, Socket.IO rooms, Next.js custom server, lifecycle
│   ├── scripts/seed.ts        # Explicit development-only sample data (never auto-run)
│   └── tests/                 # Domain/API integration tests
├── packages/shared/           # Client-safe request schemas, app data types and API contracts
├── docs/                      # API reference and implementation/deployment architecture
├── plan.md / TODO.md           # Approved plan/design and complete tracked outcomes
├── package.json               # npm workspaces and root dev/build/lint/test scripts
└── README.md                  # Setup, Atlas, seed, test and deployment guide
```

## Required pages and application behavior

- Public pages: `/`, `/login`, `/register`, and `/display/[queueId]` (resolved by public queue identifier).
- Protected manager pages: `/dashboard`, `/dashboard/queues`, `/dashboard/queues/create`, `/dashboard/queues/[id]`, `/dashboard/analytics`, and `/dashboard/settings`.
- The manager dashboard has an adaptive sidebar/top bar, profile menu, activity notification popover, breadcrumbs, mobile drawer and persistent theme toggle. Queue detail emphasizes currently serving token, a one-click Call Next control, add-person form, ordered waiting list, move controls, cancellation confirmation, history, empty states and live synchronization.
- Public display is designed for TVs and large displays, shows queue name/status, current and recently called token numbers, waiting count and an explicitly estimated wait when enough real service-duration history exists; it is read-only and never returns contact details.
- Dashboard and analytics filters support today, last 7 days, last 30 days and custom local date ranges. Missing/unavailable timing samples remain distinct from a measured zero.

## Security, data consistency and observability

- Use bcrypt password hashes, JWT verification, HTTP-only session cookies with a non-reserved name, explicit Preview/production cookie attributes, CSRF protection for cookie-authenticated writes, credentialed CORS allow-list, Helmet headers, auth rate limits, Zod validation, safe Mongo queries, centralized errors, unauthenticated health response and graceful shutdown.
- Every operation scopes Queue/Token records to the authenticated manager. Public endpoints return intentionally limited DTOs.
- Atomic `$inc` token counters plus unique indexes prevent number collisions. Conditional queue/token state updates prevent duplicate service assignment. Queue ordering mutates only waiting tokens under an expiring distributed lock; a partial unique index and two-phase temporary position update maintain unique deterministic positions. Realtime notifications contain only safe DTOs.
- Socket.IO rooms are queue-scoped and manager-owned; public display receives only public-safe events. Clients fetch initial REST state and recover from reconnect/stale events.
- Analytics use token lifecycle and Activity timestamps. Wait is creation-to-service-start; service duration is service-start-to-completion. Daily data reconstructs queue length from real lifecycle events, arrival peak hours derive from timestamped token-created activity, and filters include custom local date ranges. Where the prompt asks for utilization but queues have no configured capacity, show waiting tokens per active queue rather than implying an unsupported capacity ratio.

## Tests, docs and release preparation

Use Vitest and Supertest for backend authentication, queue ownership, token numbering, reordering, concurrent call-next, cancellation, completion, public-data redaction and analytics. Add focused frontend tests for auth/queue forms, time filters, theme/navigation and empty/error states, plus a database-backed integration path when the in-memory MongoDB test service is available. Run language diagnostics, lint/typecheck, tests and production build; resolve critical errors before delivery. Provide optional development-only seed data, environment examples, Atlas/local setup, API and architecture docs, example requests, and unified Node deployment plus Vercel/Render-or-EC2/Atlas separation guidance. Never seed production automatically and never claim an integration works without evidence.

## Design direction

### Style alternatives

- Swiss-inspired precision dashboard with ink and electric blue (0.07).
- Warm editorial operations console with amber and charcoal (0.04).
- **Linear/Raycast-influenced quiet SaaS instrument panel with an ownable teal accent (0.08) — selected.**

### Selected style: quiet SaaS instrument panel

- **Design Movement:** Contemporary Swiss digital product design, borrowing the crisp hierarchy of Linear and the restrained utility of Raycast.
- **Core Principles:** Operational clarity first; restrained, consistent color; information-dense but breathable; interactions feel immediate and predictable.
- **Color Philosophy:** Warm, near-white surfaces and deep blue-charcoal in dark mode establish calm focus. QueueFlow teal (`#11A889`) signals action and healthy flow; amber and coral are reserved for waiting-time attention and destructive/cancel states. Gradients are rare and only add depth to a focal call-next action.
- **Layout Paradigm:** An edge-anchored command rail/sidebar with a wide, asymmetric working canvas. Queue detail uses a strong live-service column and a broader waiting-list workspace instead of a uniform card grid. Mobile reflows into focused stacked action panels.
- **Signature Elements:** A small teal flow-mark made from three offset queue bars; a fine queue-position rail that visually connects waiting rows; understated live pulse/ring on the serving token.
- **Interaction Philosophy:** Every consequential action responds immediately, uses clear loading/success feedback, and has a reversible or confirmed path where appropriate. Reordering is deliberate and keyboard/touch accessible; animation never obscures state.
- **Animation:** Framer Motion for subtle page/card entrance, token position transitions, dialogs, hover/press feedback and chart appearance; short spring transitions with small travel distances. Use reduced-motion media preferences to remove nonessential movement. Custom cursor uses MotionValues without per-move React state, is gated to desktop fine pointers and respects native text-entry/selection, touch and reduced motion.
- **Typography System:** Inter/system sans for interface text paired with IBM Plex Mono for token identifiers and KPI numerals. Compact uppercase eyebrow labels; clear 12/14/16/24/32px scale, tabular numerals for operational values.
- **Brand Essence:** QueueFlow helps service teams keep people moving with an orderly, live, measurable queue; **calm, precise, dependable**.
- **Brand Voice:** Direct and reassuring; name the next action and state, never generic welcome copy. Examples: “The next person is ready.” and “Queue paused — new tokens are on hold.”
- **Wordmark & Logo:** A custom compact mark of three progressively advancing teal bars followed by a purpose-drawn QueueFlow wordmark; token rows reuse the mark as a position motif.
- **Signature Brand Color:** QueueFlow teal `#11A889`.
