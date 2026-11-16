// service layer for bookings: one function per use case.
// owns the transaction, calls the domain for rules and the repositories for sql.
// no express here. it throws domain errors and the routes turn them into http.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { withTransaction, withSavepoint } from "../db/transaction.js";
import { Booking, businessDate, isValidDate, STAFF } from "../domain/booking.js";
import {
  DomainError,
  NotFound,
  Forbidden,
  InvalidEventDate,
  InvalidId,
  IdempotencyKeyRequired,
  IdempotencyKeyReused,
} from "../domain/errors.js";
import { isId } from "../domain/ids.js";
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

function hashRequest(input) {
  const { boothId, backdropId, eventDate, package: pkg } = input;
  return crypto.createHash("sha256").update(JSON.stringify([boothId, backdropId, eventDate, pkg])).digest("hex");
}

async function insertBooking(client, actor, input, now) {
  const catalog = new CatalogRepository(client);
  const booking = Booking.create({
    customerId: actor.id,
    booth: await catalog.findBooth(input.boothId),
    backdrop: await catalog.findBackdrop(input.backdropId),
    eventDate: input.eventDate,
    pkg: input.package,
    today: businessDate(now),
  });
  // throws BoothUnavailable if the booth is already taken that date
  return new BookingRepository(client).insert(booking);
}

// returns { booking, replayed }, or throws the attempt's error.
// the first attempt with a key runs and its outcome (booking or error) is saved
// with the key. a retry with the same key and body gets that same outcome back,
// marked replayed, and nothing runs again.
export async function createBooking(actor, input, idempotencyKey, now) {
  if (!idempotencyKey) throw new IdempotencyKeyRequired();
  const requestHash = hashRequest(input);

  const result = await withTransaction(async (client) => {
    const keys = new IdempotencyRepository(client);

    const claimed = await keys.claim(actor.id, idempotencyKey, requestHash);
    if (!claimed) {
      const previous = await keys.find(actor.id, idempotencyKey);
      if (previous.requestHash !== requestHash) throw new IdempotencyKeyReused();
      return { ...previous.outcome, replayed: true };
    }

    try {
      const saved = await withSavepoint(client, () => insertBooking(client, actor, input, now));
      const outcome = { booking: toBookingDto(saved) };
      await keys.saveOutcome(actor.id, idempotencyKey, outcome, saved.id);
      return { ...outcome, replayed: false };
    } catch (err) {
      // a broken rule (booth taken, bad date...) is the outcome of this attempt, so
      // it's saved and the transaction commits. anything else (db down, a bug) rolls
      // back everything, key included, so the client can retry
      if (!(err instanceof DomainError)) throw err;
      await keys.saveOutcome(actor.id, idempotencyKey, { error: { code: err.code, message: err.message } });
      return { thrown: err };
    }
  });

  if (result.thrown) throw result.thrown;
  if (result.error) {
    const err = new DomainError(result.error.code, result.error.message);
    err.replayed = true;
    throw err;
  }
  return { booking: result.booking, replayed: result.replayed };
}

export async function getBooking(actor, id) {
  if (!isId(id)) throw new InvalidId();
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
  if (!isId(id)) throw new InvalidId();
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
