CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booths (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  active           BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE backdrops (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE bookings (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id          BIGINT NOT NULL REFERENCES users(id),
  booth_id             TEXT NOT NULL REFERENCES booths(id),
  backdrop_id          TEXT NOT NULL REFERENCES backdrops(id),
  event_date           DATE NOT NULL,
  package              TEXT NOT NULL CHECK (package IN ('digital_only', 'digital_plus_prints')),
  status               TEXT NOT NULL DEFAULT 'pending_payment'
                         CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  deposit_amount_cents INTEGER NOT NULL CHECK (deposit_amount_cents >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at         TIMESTAMPTZ
);

-- one active booking per booth per date. cancelled ones don't count so the date frees up again
CREATE UNIQUE INDEX bookings_one_active_per_booth_date
  ON bookings (booth_id, event_date)
  WHERE status <> 'cancelled';

CREATE INDEX bookings_customer_id_idx ON bookings (customer_id);
