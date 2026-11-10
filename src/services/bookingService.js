// service layer for bookings: one function per use case.
// owns the transaction, calls the domain for rules and the repositories for sql.
// no express here. it throws domain errors and the routes turn them into http.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { withTransaction } from "../db/transaction.js";
import { Booking, isValidDate, STAFF } from "../domain/booking.js";
import { NotFound, Forbidden, InvalidEventDate, IdempotencyKeyReused } from "../domain/errors.js";
import { BookingRepository } from "../repositories/bookingRepository.js";
import { CatalogRepository } from "../repositories/catalogRepository.js";
import { IdempotencyRepository } from "../repositories/idempotencyRepository.js";

// what the api sends back. keeps the domain object out of the response
export function toBookingDto(b) {
  return {
    id: String(b.id),
    customerId: String(b.customerId),
    boothId: b.boothId,
    backdropId: b.backdropId,
    eventDate: b.eventDate,
    package: b.pkg,
    status: b.status,
    depositCents: b.depositCents,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
  };
}

function today(now) {
  return now.toISOString().slice(0, 10);
}

function hashRequest(input) {
  const { boothId, backdropId, eventDate, package: pkg } = input;
  return crypto.createHash("sha256").update(JSON.stringify([boothId, backdropId, eventDate, pkg])).digest("hex");
}

// returns { booking, replayed }. replayed is true when the key was seen before
// and we're giving back the booking that the first request made.
export async function createBooking(actor, input, idempotencyKey, now) {
  return withTransaction(async (client) => {
    const bookings = new BookingRepository(client);
    const keys = new IdempotencyRepository(client);

    if (idempotencyKey) {
      const requestHash = hashRequest(input);
      const claimed = await keys.claim(actor.id, idempotencyKey, requestHash);
      if (!claimed) {
        const previous = await keys.find(actor.id, idempotencyKey);
        if (previous.requestHash !== requestHash) throw new IdempotencyKeyReused();
        const booking = await bookings.findById(previous.bookingId);
        return { booking: toBookingDto(booking), replayed: true };
      }
    }

    const catalog = new CatalogRepository(client);
    const booking = Booking.create({
      customerId: actor.id,
      booth: await catalog.findBooth(input.boothId),
      backdrop: await catalog.findBackdrop(input.backdropId),
      eventDate: input.eventDate,
      pkg: input.package,
      today: today(now),
    });

    // if the booth is taken this throws BoothUnavailable and the whole
    // transaction rolls back, including the key we just claimed
    const saved = await bookings.insert(booking);
    if (idempotencyKey) await keys.attachBooking(actor.id, idempotencyKey, saved.id);

    return { booking: toBookingDto(saved), replayed: false };
  });
}

export async function getBooking(actor, id) {
  const booking = await new BookingRepository(pool).findById(id);
  if (!booking) throw new NotFound("Booking not found");
  if (!booking.canBeViewedBy(actor)) throw new Forbidden();
  return toBookingDto(booking);
}

// customers see their own, staff see everything
export async function listBookings(actor) {
  const repo = new BookingRepository(pool);
  const list = actor.role === STAFF ? await repo.listAll() : await repo.listByCustomer(actor.id);
  return list.map(toBookingDto);
}

export async function cancelBooking(actor, id, now) {
  return withTransaction(async (client) => {
    const repo = new BookingRepository(client);
    // lock the row so a cancel and a payment confirm on the same booking take turns
    const booking = await repo.findById(id, { lock: true });
    if (!booking) throw new NotFound("Booking not found");
    booking.cancel(actor, now);
    await repo.save(booking);
    return toBookingDto(booking);
  });
}

export async function listBooths() {
  return new CatalogRepository(pool).listActiveBooths();
}

export async function listBackdrops() {
  return new CatalogRepository(pool).listActiveBackdrops();
}

// for showing the calendar only. the real check happens on insert
export async function getBoothAvailability(boothId, date) {
  if (!isValidDate(date)) throw new InvalidEventDate();
  const booth = await new CatalogRepository(pool).findBooth(boothId);
  if (!booth) throw new NotFound("Booth not found");
  const booked = await new BookingRepository(pool).isBoothBooked(boothId, date);
  return { boothId, date, available: booth.active && !booked };
}
