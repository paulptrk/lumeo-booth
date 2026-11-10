-- remembers which booking a POST /bookings retry already made.
-- keys are per customer so two customers can't collide on the same key
CREATE TABLE idempotency_keys (
  customer_id  BIGINT NOT NULL REFERENCES users(id),
  key          TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  booking_id   BIGINT REFERENCES bookings(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, key)
);
