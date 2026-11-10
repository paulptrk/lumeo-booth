// needs the docker db running (npm run db:up, migrate, seed).
// each test runs in a transaction that gets rolled back, so nothing is left behind.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool.js";
import { BookingRepository } from "../../src/repositories/bookingRepository.js";
import { CatalogRepository } from "../../src/repositories/catalogRepository.js";
import { Booking, CANCELLED } from "../../src/domain/booking.js";
import { BoothUnavailable } from "../../src/domain/errors.js";

after(() => pool.end());

async function inRollback(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function makeUser(client, email) {
  const { rows } = await client.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
    [email]
  );
  return rows[0].id;
}

async function makeBooking(client, customerId, eventDate = "2099-01-01") {
  const catalog = new CatalogRepository(client);
  return Booking.create({
    customerId,
    booth: await catalog.findBooth("booth_dslr_01"),
    backdrop: await catalog.findBackdrop("backdrop_pillowcase_blue"),
    eventDate,
    pkg: "digital_only",
    today: "2026-11-10",
  });
}

test("insert then findById gives back the same booking", async () => {
  await inRollback(async (client) => {
    const repo = new BookingRepository(client);
    const userId = await makeUser(client, "a@test.com");

    const saved = await repo.insert(await makeBooking(client, userId));
    assert.ok(saved.id);
    assert.equal(saved.status, "pending_payment");

    const found = await repo.findById(saved.id);
    assert.equal(found.eventDate, "2099-01-01");
    assert.equal(found.boothId, "booth_dslr_01");
    assert.equal(String(found.customerId), String(userId));
  });
});

test("second booking for same booth and date throws BoothUnavailable", async () => {
  await inRollback(async (client) => {
    const repo = new BookingRepository(client);
    const ana = await makeUser(client, "ana@test.com");
    const kim = await makeUser(client, "kim@test.com");

    await repo.insert(await makeBooking(client, ana));
    await assert.rejects(repo.insert(await makeBooking(client, kim)), BoothUnavailable);
  });
});

test("cancelling frees the date for someone else", async () => {
  await inRollback(async (client) => {
    const repo = new BookingRepository(client);
    const ana = await makeUser(client, "ana@test.com");
    const kim = await makeUser(client, "kim@test.com");

    const first = await repo.insert(await makeBooking(client, ana));
    first.cancel({ id: ana, role: "customer" }, new Date());
    await repo.save(first);

    const reloaded = await repo.findById(first.id);
    assert.equal(reloaded.status, CANCELLED);
    assert.equal(await repo.isBoothBooked("booth_dslr_01", "2099-01-01"), false);

    const second = await repo.insert(await makeBooking(client, kim));
    assert.ok(second.id);
  });
});

test("listByCustomer only returns that customer's bookings", async () => {
  await inRollback(async (client) => {
    const repo = new BookingRepository(client);
    const ana = await makeUser(client, "ana@test.com");
    const kim = await makeUser(client, "kim@test.com");

    await repo.insert(await makeBooking(client, ana, "2099-01-01"));
    await repo.insert(await makeBooking(client, kim, "2099-01-02"));

    const anas = await repo.listByCustomer(ana);
    assert.equal(anas.length, 1);
    assert.equal(anas[0].eventDate, "2099-01-01");
  });
});

test("findById returns null for missing or non-numeric ids", async () => {
  const repo = new BookingRepository(pool);
  assert.equal(await repo.findById("999999999"), null);
  assert.equal(await repo.findById("abc"), null);
});
