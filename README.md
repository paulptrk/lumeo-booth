# Lumeo Booth

Booking and deposit service for Lumeo photobooth rentals. Express + PostgreSQL.

## Setup

Needs Node 22+ and Docker Desktop.

```bash
npm install
cp .env.example .env
npm run db:up      # starts postgres in docker
npm run migrate
npm run seed
npm run dev        # http://localhost:3000
```

Check it works: `GET http://localhost:3000/health` should return `{"status":"ok","db":"up"}`.

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
scripts/         migrate / seed / test scripts
```

Dependencies point inward: routes and repositories can import from `domain/`, but `domain/` never imports anything from outside `domain/`.

Tests: `npm test` (uses node's built-in test runner, no db needed for domain tests).

Errors: throw a `DomainError` subclass (from `src/domain/errors.js`) with a `code`. Services never set http status codes. The `STATUS` map in `src/middleware/errorHandler.js` turns the code into a status.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/booths` | no | active booths |
| GET | `/backdrops` | no | active backdrops |
| GET | `/booths/:id/availability?date=YYYY-MM-DD` | no | display only, the real check is on insert |
| POST | `/bookings` | yes | optional `Idempotency-Key` header. 201 new, 200 replay, 409 taken |
| GET | `/bookings` | yes | customers get their own, staff get all |
| GET | `/bookings/:id` | yes | owner or staff |
| PATCH | `/bookings/:id/cancel` | yes | owner or staff |

POST body: `{ "boothId", "backdropId", "eventDate", "package" }`

**Auth for now:** until login is done, `src/middleware/fakeAuth.js` reads `X-User-Id` (and `X-User-Role: staff`) from headers. Look up the dev user ids with `SELECT id, email FROM users`. The real middleware only needs to set `req.user = { id, role }`.

To change the schema, add a new numbered file in `migrations/` (e.g. `003_...sql`). Don't edit one that's already been applied.
