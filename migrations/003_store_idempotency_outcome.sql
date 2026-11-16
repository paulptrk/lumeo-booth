-- store the whole outcome of the first attempt, not just the booking id, so a
-- retry gets back the same result even when it was an error (e.g. a 409).
-- outcome is { "booking": {...} } or { "error": { "code", "message" } }
ALTER TABLE idempotency_keys ADD COLUMN outcome JSONB;

-- keys saved before this migration all made a booking, so rebuild their outcome from it
UPDATE idempotency_keys k
SET outcome = jsonb_build_object('booking', jsonb_build_object(
  'id', b.id::text,
  'customerId', b.customer_id::text,
  'boothId', b.booth_id,
  'backdropId', b.backdrop_id,
  'eventDate', b.event_date::text,
  'package', b.package,
  'status', b.status,
  'depositCents', b.deposit_amount_cents,
  'createdAt', b.created_at,
  'cancelledAt', b.cancelled_at
))
FROM bookings b
WHERE b.id = k.booking_id;
