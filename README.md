# Lumeo Booth

Booking and deposit service for Lumeo photobooth rentals. Express + PostgreSQL.

## Setup

Needs Node 22+ and Docker Desktop.

```bash
npm install
cp .env.example .env   # then set your own POSTGRES_PASSWORD (and the same one in DATABASE_URL) and JWT_SECRET
npm run db:up      # starts postgres in docker
npm run migrate
npm run seed
npm run dev        # http://localhost:3000
```

Check it works: `GET http://localhost:3000/health` should return `{"status":"ok","db":"up"}`.

## Run everything in Docker

Runs the api and the database together. Needs Docker Desktop only (no local Node).

```bash
npm run up           # builds the image, starts db + app, applies migrations on startup
npm run seed:docker  # sample booths, backdrops and dev users (run once, safe to repeat)
```

Then open http://localhost:3000/docs. Stop with `npm run down`, which stops both containers (data stays in the `pgdata` volume).

- The app container needs port 3000. Stop `npm run dev` first, or the two will clash.
- Inside the compose network the app reaches the database at `db:5432`. From your machine it is `localhost:5433` (what `.env` uses for `npm run dev` and `npm test`).
- The image runs as a non-root user with `NODE_ENV=production` and does not contain `.env`. The database user, password and name come from your `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`); compose refuses to start if they're missing, and there are no passwords in `docker-compose.yml`.
- Pick your own password in `.env` before the first `npm run db:up`. Postgres only reads it when the `pgdata` volume is first created, so changing it later needs `docker compose down -v` (this deletes the data) or an `ALTER USER`.
- Migrations run every time the container starts and only apply new files. If the database isn't ready yet the container exits and restarts until it is.

## Demo front end

With the app running, open http://localhost:3000. It's one plain page ([public/index.html](public/index.html), no build step) for testing the api by hand:

- **Sign in** with the dev customer or staff account (one click), or log in / register any email. The page keeps the JWT for the browser tab and shows the user id and role it claims.
- **Book a booth** with a visible `Idempotency-Key`. Clicking Book again with the same key shows a replay; changing the body but keeping the key shows `idempotency_key_reused`. "Check availability" calls the availability endpoint.
- **Race for one date** fires N bookings at once (different keys or the same key) and shows the statuses. Browsers open at most 6 connections per site, so `npm run demo:concurrency` remains the real proof.
- **Bookings** lists what the server lets you see (customers their own, staff everything) with a Cancel button.
- **Request log** shows every call with its status, error code and `Idempotent-Replayed` header.

The page only calls the public api, so every rule is still enforced by the server.

## Concurrency demo

With the app running (Docker or `npm run dev`) and the db seeded:

```bash
npm run demo:concurrency
```

It fires 10 `POST /bookings` at once for the same booth and date and expects exactly one `201` and nine `409 booth_unavailable`. It then sends the same request with one `Idempotency-Key` 10 times at once and expects ten `201`s with the same booking: one created it and nine are replays (marked `Idempotent-Replayed: true`). It also checks the database holds one booking, exits non-zero on any mismatch, and cancels its demo bookings afterwards. The reason it holds is explained at the top of [scripts/concurrency-demo.js](scripts/concurrency-demo.js): the unique partial index decides, not a check before the insert.

## Project structure

```
src/
  routes/        interface: read the request, call a service, send the response
  middleware/    interface: auth, error code -> http status
  services/      use cases: idempotency, transactions, return plain objects (DTOs)
  domain/        business rules as methods on objects. only imports other domain files (no express, no sql)
  repositories/  data source: sql, turns rows into domain objects and back
  db/            postgres connection pool
migrations/      numbered .sql files, run in order by `npm run migrate`
seeds/           sample booths, backdrops and two dev users
scripts/         migrate, seed and the concurrency demo
test/            domain, service, middleware and contract tests
openapi.yaml     the api contract (served at /docs)
```

Dependencies point inward: routes and repositories can import from `domain/`, but `domain/` never imports anything from outside `domain/`.

To change the schema, add a new numbered file in `migrations/` (e.g. `003_...sql`). Don't edit one that's already been applied.

Tests: `npm test` (node's built-in test runner). Domain tests need no database. The service and contract tests need postgres running (`npm run db:up` or `npm run up`) and create and delete their own test users. `test/contract/conformance.test.js` calls every endpoint and checks each response against `openapi.yaml`, and fails if a route exists in Express but not in the spec.

Errors: throw a `DomainError` subclass (from `src/domain/errors.js`) with a `code`. Services never set http status codes. The `STATUS` map in `src/middleware/errorHandler.js` turns the code into a status.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/booths` | no | active booths |
| GET | `/backdrops` | no | active backdrops |
| GET | `/booths/:id/availability?date=YYYY-MM-DD` | no | display only, the real check is on insert |
| POST | `/bookings` | yes | requires an `Idempotency-Key` header. 201 created, 409 taken. A retry with the same key gets the first attempt's status and body back (errors too) |
| GET | `/bookings` | yes | customers get their own, staff get all |
| GET | `/bookings/:id` | yes | owner or staff |
| PATCH | `/bookings/:id/cancel` | yes | owner or staff |
| POST | `/auth/login` | no | `{email, password}`. 200 `{token}`, 401 wrong email or password, 422 missing or malformed fields |
| POST | `/auth/register` | no | `{email, password}`. 201 `{token}`, 409 email taken, 422 bad email or password. Always creates a customer |
| GET | `/health` | no | `{"status":"ok","db":"up"}`, 503 if the db is down |
| GET | `/docs` | no | Swagger UI |
| GET | `/openapi.yaml` | no | the raw spec |

POST body: `{ "boothId", "backdropId", "eventDate", "package" }`

**API contract:** [openapi.yaml](openapi.yaml) is the source of truth. With the server running, browse it at http://localhost:3000/docs (Swagger UI, use "Authorize" and paste a token from `POST /auth/login`) or fetch the raw file from http://localhost:3000/openapi.yaml.

**Auth:** `POST /auth/register` (always creates a customer) and `POST /auth/login` return a signed JWT. Send it as `Authorization: Bearer <token>` on every `/bookings` route. `src/middleware/jwtAuth.js` checks the token and loads the user from the `users` table, so the role (customer or staff) comes from `users.role`, never from the request or the token. A missing, invalid or expired token returns 401 `unauthenticated`. `JWT_SECRET` (32+ characters) must be set in `.env`.

## AI collaboration log

[docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md) tracks where the AI assistant was wrong, incomplete or insecure and how it was fixed (course report requirement).
