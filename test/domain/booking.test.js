import { test } from "node:test";
import assert from "node:assert/strict";
import { Booking, CANCELLED, CONFIRMED, PENDING_PAYMENT, DEPOSIT_CENTS } from "../../src/domain/booking.js";
import {
  Forbidden,
  BoothNotBookable,
  BackdropNotAvailable,
  InvalidPackage,
  InvalidEventDate,
  BookingCancelled,
} from "../../src/domain/errors.js";

const booth = { id: "booth_dslr_01", active: true };
const backdrop = { id: "backdrop_pillowcase_blue", active: true };
const today = "2026-11-10";

function newBooking(overrides = {}) {
  return Booking.create({
    customerId: "1",
    booth,
    backdrop,
    eventDate: "2026-12-05",
    pkg: "digital_only",
    today,
    ...overrides,
  });
}

const owner = { id: 1, role: "customer" };
const otherCustomer = { id: 2, role: "customer" };
const staff = { id: 99, role: "staff" };

test("create gives a pending booking with the deposit", () => {
  const b = newBooking();
  assert.equal(b.status, PENDING_PAYMENT);
  assert.equal(b.depositCents, DEPOSIT_CENTS);
  assert.equal(b.boothId, "booth_dslr_01");
});

test("create rejects inactive or missing booth", () => {
  assert.throws(() => newBooking({ booth: { id: "booth_360_01", active: false } }), BoothNotBookable);
  assert.throws(() => newBooking({ booth: null }), BoothNotBookable);
});

test("create rejects inactive backdrop", () => {
  assert.throws(() => newBooking({ backdrop: { id: "x", active: false } }), BackdropNotAvailable);
});

test("create rejects unknown package", () => {
  assert.throws(() => newBooking({ pkg: "everything" }), InvalidPackage);
});

test("create rejects past, today, and invalid dates", () => {
  assert.throws(() => newBooking({ eventDate: "2026-11-01" }), InvalidEventDate);
  assert.throws(() => newBooking({ eventDate: today }), InvalidEventDate);
  assert.throws(() => newBooking({ eventDate: "2026-02-31" }), InvalidEventDate);
  assert.throws(() => newBooking({ eventDate: "next friday" }), InvalidEventDate);
});

test("owner and staff can view, other customers can't", () => {
  const b = newBooking();
  assert.equal(b.canBeViewedBy(owner), true);
  assert.equal(b.canBeViewedBy(staff), true);
  assert.equal(b.canBeViewedBy(otherCustomer), false);
});

test("owner id as number still matches customer id from postgres (string)", () => {
  const b = newBooking({ customerId: "1" });
  assert.equal(b.isOwnedBy({ id: 1, role: "customer" }), true);
});

test("other customer can't cancel", () => {
  const b = newBooking();
  assert.throws(() => b.cancel(otherCustomer, "2026-11-10T12:00:00Z"), Forbidden);
  assert.equal(b.status, PENDING_PAYMENT);
});

test("cancel twice is the same end state", () => {
  const b = newBooking();
  b.cancel(owner, "2026-11-10T12:00:00Z");
  b.cancel(owner, "2026-11-10T13:00:00Z");
  assert.equal(b.status, CANCELLED);
  assert.equal(b.cancelledAt, "2026-11-10T12:00:00Z");
});

test("staff can cancel any booking", () => {
  const b = newBooking();
  b.cancel(staff, "2026-11-10T12:00:00Z");
  assert.equal(b.status, CANCELLED);
});

test("confirm payment on a cancelled booking fails", () => {
  const b = newBooking();
  b.cancel(owner, "2026-11-10T12:00:00Z");
  assert.throws(() => b.confirmPayment(), BookingCancelled);
});

test("confirm payment moves pending to confirmed", () => {
  const b = newBooking();
  b.confirmPayment();
  assert.equal(b.status, CONFIRMED);
});
