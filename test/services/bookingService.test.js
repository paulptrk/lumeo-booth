// needs the docker db running. these go through real transactions, so the
// test users and their bookings are deleted at the end.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool.js";
import * as service from "../../src/services/bookingService.js";
import { BoothUnavailable, Forbidden, NotFound, IdempotencyKeyReused } from "../../src/domain/errors.js";

const now = new Date("2026-11-10T12:00:00Z");
const run = Date.now();
let ana, kim, staff;

async function makeUser(name, role = "customer") {
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', $2) RETURNING id",
    [`${name}-${run}@test.com`, role]
  );
  return { id: rows[0].id, role };
}

function input(eventDate) {
  return { boothId: "booth_dslr_01", backdropId: "backdrop_pillowcase_blue", eventDate, package: "digital_only" };
}

before(async () => {
  ana = await makeUser("ana");
  kim = await makeUser("kim");
  staff = await makeUser("staff", "staff");
});

after(async () => {
  const ids = [ana.id, kim.id, staff.id];
  await pool.query("DELETE FROM idempotency_keys WHERE customer_id = ANY($1)", [ids]);
  await pool.query("DELETE FROM bookings WHERE customer_id = ANY($1)", [ids]);
  await pool.query("DELETE FROM users WHERE id = ANY($1)", [ids]);
  await pool.end();
});

test("create then the same booth and date again is BoothUnavailable", async () => {
  const { booking } = await service.createBooking(ana, input("2098-01-01"), null, now);
  assert.equal(booking.status, "pending_payment");
  await assert.rejects(service.createBooking(kim, input("2098-01-01"), null, now), BoothUnavailable);
});

test("same idempotency key twice gives back the same booking", async () => {
  const first = await service.createBooking(ana, input("2098-01-02"), "key-1", now);
  const second = await service.createBooking(ana, input("2098-01-02"), "key-1", now);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.booking.id, first.booking.id);
});

test("same key with a different body is rejected", async () => {
  await service.createBooking(ana, input("2098-01-03"), "key-2", now);
  await assert.rejects(service.createBooking(ana, input("2098-01-04"), "key-2", now), IdempotencyKeyReused);
});

test("double click: same key sent 5 times at once makes one booking", async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () => service.createBooking(kim, input("2098-01-05"), "key-3", now))
  );
  const ids = new Set(results.map((r) => r.booking.id));
  assert.equal(ids.size, 1);
  assert.equal(results.filter((r) => !r.replayed).length, 1);
});

test("a failed booking doesn't burn the key", async () => {
  await service.createBooking(ana, input("2098-01-06"), null, now);
  await assert.rejects(service.createBooking(kim, input("2098-01-06"), "key-4", now), BoothUnavailable);
  // key wasn't saved, so using it for a free date works
  const { replayed } = await service.createBooking(kim, input("2098-01-07"), "key-4", now);
  assert.equal(replayed, false);
});

test("customers only see their own bookings, staff see all", async () => {
  const { booking } = await service.createBooking(ana, input("2098-02-01"), null, now);
  await assert.rejects(service.getBooking(kim, booking.id), Forbidden);
  assert.equal((await service.getBooking(staff, booking.id)).id, booking.id);

  const kims = await service.listBookings(kim);
  assert.ok(kims.every((b) => b.customerId === String(kim.id)));
  const all = await service.listBookings(staff);
  assert.ok(all.some((b) => b.id === booking.id));
});

test("cancel frees the date and other customers can't cancel", async () => {
  const { booking } = await service.createBooking(ana, input("2098-03-01"), null, now);
  await assert.rejects(service.cancelBooking(kim, booking.id, now), Forbidden);

  const cancelled = await service.cancelBooking(ana, booking.id, now);
  assert.equal(cancelled.status, "cancelled");
  const avail = await service.getBoothAvailability("booth_dslr_01", "2098-03-01");
  assert.equal(avail.available, true);
});

test("missing booking is NotFound", async () => {
  await assert.rejects(service.getBooking(ana, "999999999"), NotFound);
  await assert.rejects(service.cancelBooking(ana, "abc", now), NotFound);
});
