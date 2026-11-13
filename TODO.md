# QueueFlow delivery outcomes

Progress is evidence-based. An item remains open until its stated application behavior or deliverable exists and has been verified; a written intention alone does not count as completion.

**Verified in this run:** 23 automated tests pass (13 backend/API/socket and 10 frontend); TypeScript, lint, formatting and production build pass; `npm audit` reports zero vulnerabilities; live Preview health reports MongoDB connected and the route manifest lists all 10 application pages. README contains screenshot captures of the public landing/sign-in pages at desktop, tablet and mobile sizes; protected dashboard page-action and viewport checks remain open.

The Atlas URI and JWT signing secret were supplied through protected project input; keep both out of source, examples and logs. Database integration tests use an isolated in-memory MongoDB.

## 1. Manager authentication and account security

- [x] Manager registration validates name, email and password; login rejects invalid credentials; passwords are stored only as bcrypt hashes; logout clears the application session; `GET /api/auth/me` resolves the authenticated manager; protected dashboard routes require a valid JWT-backed session.
- [x] Persist the session with a secure HTTP-only cookie where appropriate, use a cookie name that does not collide with platform-owned cookies, configure cross-site HTTPS Preview cookies as `SameSite=None; Secure`, keep local HTTP behavior explicitly configurable, and protect cookie-authenticated mutations against CSRF.
- [x] Add authentication middleware, Zod validation, proper error handling, authentication rate limits, CORS configuration and session persistence; never expose password hashes, JWT secrets or other sensitive values to the frontend.

## 2. Queue lifecycle and ownership

- [x] A manager can create and manage multiple queues. Each queue has a name, optional description, unique queue identifier/public display identifier, creation/update dates, status and token count.
- [x] A manager can create, edit, view, activate, pause, resume, close and delete queues; queue deletion uses an appropriate confirmation dialog. Queue listing supports search, sorting and filtering and uses professional cards or a data table.
- [x] Every manager operation checks queue ownership; never trust a queue ID supplied by the frontend without checking ownership. Validate input, paginate/filter/sort where applicable, return consistent API response shapes and proper HTTP status codes, and centralize error handling.

## 3. Token creation, numbering and history

- [x] A manager can add a person's name and optional contact information to the correct queue. The application immediately displays the new token, records token creation time, associates it with the queue, assigns waiting status and places it in the waiting list.
- [x] Generate unique per-queue token numbers (for example Q001, Q002) that do not collide during concurrent requests, using an atomic sequence strategy and database uniqueness protection. Store person name, optional phone, lifecycle status, position, creation/update timestamps and called/service-start/completion/cancellation timestamps.
- [x] Managers can view every waiting token through bounded server-side pages of up to 100 records, search all waiting tokens by person or token identifier, paginate the entire completed/cancelled token history, and see token number, person, absolute queue position, waiting duration and status. Public APIs must not expose private contact details.
- [x] Token statuses include waiting, called, serving, completed and cancelled. Destructive token operations use confirmation dialogs; forms show inline validation, required indicators, loading/success/error feedback and prevent duplicate submissions. Do not use browser `alert()`.

## 4. Queue ordering, service assignment and completion

- [x] A manager can move waiting tokens upward or downward and change their priority through the UI; only waiting tokens can be reordered. Position updates appear immediately, persist to the database, maintain consistent ordering without duplicate positions, safely handle concurrent updates and broadcast changes through Socket.IO.
- [x] Provide a prominent “Call Next Token” action. It identifies the first waiting token, assigns it for service, changes status to called or serving, records service start time, removes it from the waiting list, updates statistics, notifies connected clients, and prominently displays the current token. Two managers cannot call the same token simultaneously.
- [x] A manager can mark the serving token as completed; service completion time is recorded. A manager can cancel a waiting token, record cancellation time, and update queue ordering/statistics. After calls, completions, cancellations and reorders, the waiting list and current-serving state remain synchronized.

## 5. Real-time queue synchronization and public display

- [x] Use Socket.IO queue-specific rooms for queue/token/analytics changes. Manager-created, moved, called, completed and cancelled tokens update the manager dashboard, queue management screen, public display and relevant connected clients. REST APIs remain the source of truth; sockets distribute events.
- [x] Ensure connected clients receive only authorized events; public clients receive only public-safe queue/token information. Handle disconnections, reconnection, duplicate event prevention, stale client state and initial REST synchronization.
- [x] Provide a read-only `/display/[queueId]` public-facing screen suitable for TVs/large displays. Show queue name/status, currently serving and recently called token numbers, waiting count and estimated waiting time; use large typography, high contrast, clear visual hierarchy and smooth transitions. Optional sound notification may signal a newly called token. Do not expose manager credentials, private customer contact information or untrusted free-form queue descriptions.

## 6. Dashboard and database-derived analytics

- [x] Display total queues, total tokens generated, currently waiting, currently being served, completed and cancelled tokens, average waiting time, average service time, longest waiting time and queue utilization.
- [x] Include queue activity, waiting-time trends, daily token statistics, completed-versus-cancelled comparison, queue performance and recent activity, using responsive charts with interactive tooltips and legends.
- [x] Include today, last 7 days, last 30 days and custom local-calendar date range filters. Browser requests carry the viewer's validated IANA time zone so local date bounds, daily buckets, waiting-line history, wait-time series and peak-hour labels align across daylight-saving changes; API requests without a time zone default to UTC. Calculate every metric from actual database records, not fake live data. Waiting time is token creation to service start; service duration is service start to completion. Queue analytics include length trends, peak queue hours, daily performance and utilization. Clearly distinguish unavailable/incomplete samples from zero values.
- [x] Persist Activity records with manager, queue, token, action, description and timestamp; use token lifecycle timestamps for metrics.

## 7. UI, responsiveness, accessibility and cursor

- [x] Build public landing, login, registration, display and protected dashboard overview, queue list/create/detail, analytics and settings pages. Dashboard includes responsive sidebar, top bar, breadcrumbs, profile dropdown, notification area, theme switcher and mobile navigation drawer with active navigation indicators.
- [x] Deliver a premium SaaS interface: elegant typography, consistent spacing, refined rounded cards/borders and subtle shadows, restrained gradients, clean icons, professional data visualizations, beautiful empty states, smooth transitions, skeleton loading, toast notifications and careful hover effects; avoid generic dashboard styling, overcrowding, random colors and excessive animation.
- [x] Light and dark themes work, persist preference across routes and maintain consistent accessible contrast. A labeled mode switch appears in the public landing and login/register headers and the manager dashboard. Framer Motion provides subtle page/card/modal/dropdown/token/chart/button transitions and respects reduced-motion preferences.
- [ ] Desktop, laptop, tablet and mobile layouts work without horizontal overflow; sidebar collapses, navigation drawer works, charts/tables/forms/dialogs respond appropriately, controls are touch-friendly and cards stack with readable type. Landing screenshots were reviewed at 1280 × 800, 768 × 1024 and 390 × 844; sign-in screenshots were reviewed at 1280 × 800 and 390 × 844; protected-dashboard breakpoints still need browser verification.
- [x] Implement a reusable global custom cursor: central dot, smoothly following outer ring, subtle theme-aware accent glow, smooth motion/scaling; button/card/link hover states; drag/grab/grabbing cues; native text cursor in inputs; press feedback. Track pointers efficiently without mousemove-triggered React renders; hide on touch and keep native text selection, typing, scrolling, drag-and-drop and reduced-motion behavior intact.

## 8. API, data architecture and security controls

- [x] Use the requested modular npm-workspaces monorepo with Next.js App Router/TypeScript/Tailwind/shadcn/ui/Framer Motion/Recharts/Lucide/React Hook Form/Zod, Node.js/Express/TypeScript REST APIs, Socket.IO, JWT, bcrypt, MongoDB and Mongoose. Include TanStack Table where useful, lint/format tools and stable compatible dependencies.
- [x] Implement Manager (unique email/name/passwordHash/timestamps), Queue (managerId/name/description/publicId/status/tokenCounter/timestamps) and Token (queueId/tokenNumber/personName/optional phone/status/position/lifecycle timestamps) Mongoose models, plus Activity (managerId/queueId/tokenId/action/description/timestamp). Add appropriate indexes, unique constraints, references, validation, timestamps and efficient query patterns.
- [x] Implement the auth endpoints `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; queue endpoints `POST/GET /api/queues`, `GET/PUT /api/queues/:id`, `PATCH /api/queues/:id/status`, `DELETE /api/queues/:id`; token endpoints `POST/GET /api/queues/:id/tokens`, `GET /api/tokens/:id`, `PATCH /api/tokens/:id/reorder`, `POST /api/queues/:id/call-next`, and `PATCH /api/tokens/:id/complete|cancel`; public endpoints `GET /api/public/queues/:publicId` and `/current`; analytics endpoints `GET /api/analytics/overview`, `/queues/:id`, `/trends`, `/wait-times` and `/peak-hours`.
- [x] Apply password hashing, JWT verification, secure HTTP-only cookies, CORS, Helmet headers, auth rate limiting, input validation/sanitization, Mongo query safety, ownership checks, environment-variable protection and appropriate error handling. Never expose database credentials, JWT secrets, password hashes or private phone numbers through public APIs.
- [x] Include `/api/health`, production HTTPS/cookie behavior, graceful server shutdown and a runtime environment-based MongoDB Atlas connection; never commit real environment files or secrets.

## 9. Tests and quality verification

- [x] Write real backend tests for registration, login, invalid credentials, unauthorized access, queue creation/ownership, token generation/unique numbering, queue reordering, call-next including concurrent calls, cancellation, completion and analytics calculations.
- [ ] Write frontend tests for login/registration, queue creation, token creation, queue reordering, Call Next, theme switching, responsive navigation, empty states and error states. Current frontend automated coverage verifies shared form schemas, date-filter interactions and persisted theme; page-level manager action/navigation/error interaction tests remain open.
- [x] Verify the integration workflow: manager registers and logs in; creates a queue; adds multiple people; tokens are generated and displayed; manager reorders tokens and calls the next one; public display updates; manager completes service; analytics update correctly. API/lifecycle, public-event and analytics paths are exercised in the isolated integration suite.
- [ ] Test common desktop/tablet/mobile viewports, edge cases, lint/typecheck/tests and production builds; fix discovered errors before delivery and do not claim an unverified feature works. Edge cases and build/lint/typecheck/tests passed; landing/sign-in screenshots were reviewed at three viewport sizes, but a protected-dashboard sweep remains open.

## 10. Demo data, documentation and GitHub readiness

- [x] Provide an optional development-only seed script with one demo manager, three sample queues, multiple tokens with different statuses and historical activity records using realistic timestamps. Clearly document demo credentials and never automatically seed demo users in production.
- [x] Provide `.gitignore`, frontend and backend environment examples without real secrets, and a professional README with project introduction, features, stack, architecture, folder structure, screenshots section, installation, environment configuration, API docs, database models, demo credentials, tests and deployment instructions.
- [x] Provide `docs/API.md`, `docs/ARCHITECTURE.md`, example API requests, setup instructions for Node and local MongoDB or Atlas, dependency install, DB connection, seed execution, frontend/backend startup, Socket.IO setup and production build commands. Root npm scripts should include practical `dev`, `build`, `lint` and `test` commands that actually work.
- [x] Prepare Vercel frontend, Render or AWS EC2 backend and MongoDB Atlas deployment instructions covering production environment variables, CORS, secure cookies, Socket.IO, HTTPS, health checks, graceful shutdown and production build verification. Make the repository GitHub-ready; never claim a repository was pushed unless that action is completed and confirmed.
