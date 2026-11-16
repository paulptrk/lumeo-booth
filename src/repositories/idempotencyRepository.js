// idempotency keys for POST /bookings. db should be a client inside the
// same transaction as the booking insert, so the key and its outcome are
// saved together or not at all.

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

  // returns { requestHash, outcome } or null
  async find(customerId, key) {
    const { rows } = await this.db.query(
      "SELECT request_hash, outcome FROM idempotency_keys WHERE customer_id = $1 AND key = $2",
      [customerId, key]
    );
    if (!rows[0]) return null;
    return { requestHash: rows[0].request_hash, outcome: rows[0].outcome };
  }

  async saveOutcome(customerId, key, outcome, bookingId = null) {
    await this.db.query(
      "UPDATE idempotency_keys SET outcome = $3, booking_id = $4 WHERE customer_id = $1 AND key = $2",
      [customerId, key, outcome, bookingId]
    );
  }
}
