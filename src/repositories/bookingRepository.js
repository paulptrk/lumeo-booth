// data mapper for bookings: all the booking sql lives here.
// turns rows into Booking objects and back. db can be the pool or a client
// inside a transaction (the service decides).

import { Booking } from "../domain/booking.js";
import { BoothUnavailable } from "../domain/errors.js";

const UNIQUE_VIOLATION = "23505";
const ONE_PER_BOOTH_DATE = "bookings_one_active_per_booth_date";

const COLUMNS = `id, customer_id, booth_id, backdrop_id, event_date, package,
  status, deposit_amount_cents, created_at, cancelled_at`;

function toBooking(row) {
  return new Booking({
    id: row.id,
    customerId: row.customer_id,
    boothId: row.booth_id,
    backdropId: row.backdrop_id,
    eventDate: row.event_date,
    pkg: row.package,
    status: row.status,
    depositCents: row.deposit_amount_cents,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  });
}

// ids are BIGINT. anything that isn't digits can't match, and would make postgres throw
function isId(id) {
  return /^\d+$/.test(String(id));
}

export class BookingRepository {
  constructor(db) {
    this.db = db;
  }

  // no "is it free?" select first. the unique index decides, so if two requests
  // insert the same booth + date at the same time only one row gets in
  async insert(booking) {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO bookings
           (customer_id, booth_id, backdrop_id, event_date, package, status, deposit_amount_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [
          booking.customerId,
          booking.boothId,
          booking.backdropId,
          booking.eventDate,
          booking.pkg,
          booking.status,
          booking.depositCents,
        ]
      );
      return toBooking(rows[0]);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION && err.constraint === ONE_PER_BOOTH_DATE) {
        throw new BoothUnavailable();
      }
      throw err;
    }
  }

  // lock: true adds FOR UPDATE so two writers on the same booking take turns.
  // only does anything inside a transaction
  async findById(id, { lock = false } = {}) {
    if (!isId(id)) return null;
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM bookings WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
      [id]
    );
    return rows[0] ? toBooking(rows[0]) : null;
  }

  async listByCustomer(customerId) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM bookings WHERE customer_id = $1 ORDER BY event_date, id`,
      [customerId]
    );
    return rows.map(toBooking);
  }

  async listAll() {
    const { rows } = await this.db.query(`SELECT ${COLUMNS} FROM bookings ORDER BY event_date, id`);
    return rows.map(toBooking);
  }

  async isBoothBooked(boothId, eventDate) {
    const { rows } = await this.db.query(
      "SELECT 1 FROM bookings WHERE booth_id = $1 AND event_date = $2 AND status <> 'cancelled'",
      [boothId, eventDate]
    );
    return rows.length > 0;
  }

  // only status and cancelled_at change after a booking is created
  async save(booking) {
    await this.db.query("UPDATE bookings SET status = $2, cancelled_at = $3 WHERE id = $1", [
      booking.id,
      booking.status,
      booking.cancelledAt,
    ]);
  }
}
