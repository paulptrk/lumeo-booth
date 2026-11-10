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
  routes/        http only: read the request, call a service, send the response
  services/      business rules (ownership, booking rules)
  repositories/  sql queries
  middleware/    auth, error handling
  db/            postgres connection pool
migrations/      numbered .sql files, run in order by `npm run migrate`
seeds/           sample booths and backdrops
scripts/         migrate / seed / test scripts
```

To change the schema, add a new numbered file in `migrations/` (e.g. `003_...sql`). Don't edit one that's already been applied.
