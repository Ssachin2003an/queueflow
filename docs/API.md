# QueueFlow API reference

Base URL: `http://localhost:3000/api` in the unified development server; production uses the deployed application/API origin. All JSON endpoints use `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`. IDs in path segments are MongoDB IDs unless the route explicitly says `publicId`.

## Sessions and CSRF

Manager sessions use the HTTP-only `queueflow_session` JWT cookie (seven-day expiry). State-changing requests require `x-csrf-token` to exactly match the browser-visible `queueflow_csrf` cookie. First call `GET /auth/csrf`, then send the returned `data.csrfToken` header; register/login rotate the CSRF token. The client library handles this handshake and includes credentials. A 401 means an absent/expired session; 403 means CSRF validation failed; 503 means the Atlas/local Mongo connection or required signing configuration is unavailable.

| Method | Route            | Auth                       | Behavior                                                                                                                      |
| ------ | ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`        | Public                     | 200 when Mongo is connected; 503/degraded otherwise.                                                                          |
| `GET`  | `/auth/csrf`     | Public                     | Set a CSRF cookie and return a one-time-per-bootstrap double-submit token; response is `no-store`.                            |
| `POST` | `/auth/register` | Public + CSRF + rate limit | `{name,email,password}`; create a uniquely normalized manager, return a safe manager DTO and set JWT/CSRF cookies.            |
| `POST` | `/auth/login`    | Public + CSRF + rate limit | `{email,password}`; return a safe manager DTO and rotate the session/CSRF cookies. Invalid credentials use a generic message. |
| `POST` | `/auth/logout`   | CSRF                       | Clear application session and CSRF cookies.                                                                                   |
| `GET`  | `/auth/me`       | Manager                    | Return only the session owner's `id`, `name`, `email` and creation time.                                                      |

## Queues

All manager queue routes scope by the authenticated manager; another user's queue behaves as not found.

| Method   | Route                                        | Behavior                                                                                                                                                     |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/queues`                                    | `{name,description?}`; create an active queue with an unguessable public ID and token counter.                                                               |
| `GET`    | `/queues?search=&status=all&page=1&limit=20` | Manager-owned queues, current record-derived token/waiting/serving counts and pagination. `status` is `all`, `active`, `paused` or `closed`; limit is 1–100. |
| `GET`    | `/queues/:id`                                | Inspect one owned queue.                                                                                                                                     |
| `PUT`    | `/queues/:id`                                | Change `{name?,description?}`.                                                                                                                               |
| `PATCH`  | `/queues/:id/status`                         | Set `{status:"active"                                                                                                                                        | "paused" | "closed"}`. Only active queues accept token creation and Call Next. |
| `DELETE` | `/queues/:id`                                | Permanently delete that queue and its tokens/activity; confirm in the UI first.                                                                              |

## Tokens and service transitions

| Method  | Route                                                       | Behavior                                                                                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`  | `/queues/:id/tokens`                                        | `{personName,phone?}`; add to an active queue, atomically allocate the next per-queue integer and a waiting position.                                                                                                                                                                            |
| `GET`   | `/queues/:id/tokens?status=waiting&search=&page=1&limit=50` | Search owner-visible token history by name or number. Status can be `all`, `waiting`, `called`, `serving`, `completed` or `cancelled`; `Q001` and `1` search the same token number. Only the owning manager receives phone values. Waiting rows sort by position; other history is newest first. |
| `GET`   | `/tokens/:id`                                               | Inspect an owned token (including its manager-only phone, if present).                                                                                                                                                                                                                           |
| `PATCH` | `/tokens/:id/reorder`                                       | `{position}`; reorder one waiting token. Positions are zero-based; the server clamps an out-of-range target to the end of the line.                                                                                                                                                              |
| `POST`  | `/queues/:id/call-next`                                     | `{}`; atomically claim the first waiting token on an active queue, set `serving`, `calledAt` and `serviceStartedAt`, and release its waiting position. Returns `{token:null}` if the line is clear; a current service yields 409.                                                                |
| `PATCH` | `/tokens/:id/complete`                                      | `{}`; only the current called/serving token can complete; persist `completedAt` and release the queue's service slot.                                                                                                                                                                            |
| `PATCH` | `/tokens/:id/cancel`                                        | `{}`; only a waiting token can be cancelled; persist `cancelledAt` and compact the remaining positions.                                                                                                                                                                                          |

Token numbers are unique and monotonic within their queue; display labels are formatted as `Q001`, `Q002`, … . Database uniqueness and a queue-level atomic counter guard simultaneous requests. Queue ordering actions share a short-lived Mongo-backed lease and a partial unique index for waiting positions; conflicts return 409 and can be retried. Lifecycle durations are in milliseconds in API analytics values.

## Public display

| Method | Route                              | Auth   | Behavior                                                                                                                                                                       |
| ------ | ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/public/queues/:publicId`         | Public | Queue name/status, waiting count, current token, recent token numbers and estimated wait. Public DTOs omit manager-written description, visitor name/phone and manager fields. |
| `GET`  | `/public/queues/:publicId/current` | Public | Alias for the current read-only display DTO.                                                                                                                                   |

The estimated wait is `average completed service duration × people ahead`, adjusted for the unfinished current service. It is null if there is no usable service sample; the public display shows a dash rather than inventing one.

## Analytics

| Method | Route                                                     | Behavior                                                                                                                                                                                                                         |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/analytics/overview?from=<ISO>&to=<ISO>&timezone=<IANA>` | Current waiting/serving, created-in-range token total, completions by `completedAt`, cancellations by `cancelledAt`, active/total queues, wait/service means, longest observed wait, utilization definition and recent activity. |
| `GET`  | `/analytics/queues/:id?from=&to=&timezone=`               | Per-status token totals and in-range wait samples/means for an owned queue.                                                                                                                                                      |
| `GET`  | `/analytics/trends?days=7&from=&to=&timezone=`            | Daily arrivals (`total`), service completions, cancellations and reconstructed end-of-day waiting-line count. Empty calendar days are included.                                                                                  |
| `GET`  | `/analytics/wait-times?from=&to=&timezone=`               | Daily average wait and sample count for service starts during the selected range.                                                                                                                                                |
| `GET`  | `/analytics/peak-hours?from=&to=&timezone=`               | 24 local-hour arrival bins with real token-created counts.                                                                                                                                                                       |

`from` and `to` accept ISO dates/timestamps; invalid or reversed ranges return 400. `timezone` accepts a valid IANA time-zone name, such as `America/Los_Angeles`; the browser sends the viewer's time zone so local date boundaries, daily bins and peak-hour labels align, and requests without it default to UTC. Calendar trends are limited to 366 local dates. `days` controls the default trend window when explicit boundaries are absent. Wait is `serviceStartedAt - createdAt`. Service duration is `completedAt - serviceStartedAt`. Missing averages are JSON `null`, not fabricated zeros. Since a queue has no configured capacity, `queueUtilization` is reported as waiting tokens per active queue (and is labelled that way), not as a capacity percentage.

## Socket.IO

Socket.IO shares the application origin at `/socket.io` and uses credentialed connections. A manager connects with its `queueflow_session` cookie and may join `queue:join` with a queue ID only if it owns that queue. Public display connects using its `publicId`. Safe `queue:updated` events notify queue-room, owner-room and public-room clients after real state changes. Public events omit visitor names and phones. A client first loads REST state and refetches after reconnect/update; REST remains authoritative.

## Example flow

The API client automatically applies the CSRF token. A manual registration flow using curl:

```bash
BASE=http://localhost:3000/api
curl -sS -c /tmp/queueflow-cookie.txt "$BASE/auth/csrf" > /tmp/queueflow-csrf.json
CSRF=$(jq -r '.data.csrfToken' /tmp/queueflow-csrf.json)
curl -sS -b /tmp/queueflow-cookie.txt -c /tmp/queueflow-cookie.txt \
  -H "content-type: application/json" -H "x-csrf-token: $CSRF" \
  -d '{"name":"Avery Manager","email":"avery@example.test","password":"replace-with-a-long-password"}' \
  "$BASE/auth/register" > /tmp/queueflow-register.json
CSRF=$(jq -r '.data.csrfToken' /tmp/queueflow-register.json)
curl -sS -b /tmp/queueflow-cookie.txt "$BASE/auth/me"
curl -sS -b /tmp/queueflow-cookie.txt -H "x-csrf-token: $CSRF" \
  -H "content-type: application/json" -d '{"name":"Front desk","description":"Walk-in service"}' "$BASE/queues"
```

In production, use a protected secret store for Atlas URI, JWT and cookie signing values; use HTTPS origins and keep the browser-facing API/socket origin consistent with the CORS allow-list.
