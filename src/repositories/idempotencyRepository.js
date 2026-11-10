// idempotency keys for POST /bookings. db should be a client inside the
// same transaction as the booking insert, so both commit or neither does.

export class IdempotencyRepository {
  constructor(db) {
    this.db = db;
  }

  // returns true if we got the key. false means another request already has it.
  // if that other request is still running, postgres waits for it to finish first
  async claim(customerId, key, requestHash) {
    const { rows } = await this.db.query(
      `INSERT INTO idempotency_keys (customer_id, key, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING key`,
      [customerId, key, requestHash]
    );
    return rows.length > 0;
  }

  async find(customerId, key) {
    const { rows } = await this.db.query(
      "SELECT request_hash, booking_id FROM idempotency_keys WHERE customer_id = $1 AND key = $2",
      [customerId, key]
    );
    if (!rows[0]) return null;
    return { requestHash: rows[0].request_hash, bookingId: rows[0].booking_id };
  }

  async attachBooking(customerId, key, bookingId) {
    await this.db.query(
      "UPDATE idempotency_keys SET booking_id = $3 WHERE customer_id = $1 AND key = $2",
      [customerId, key, bookingId]
    );
  }
}
