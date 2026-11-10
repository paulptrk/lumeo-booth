// booking rules. no express or sql here.
// dates are "YYYY-MM-DD" strings and the current time is passed in,
// so nothing in this file reads the clock.
//
// status: pending_payment -> confirmed, and either one -> cancelled
// "one booth per date" is not checked here. the unique index in the db
// enforces it, and the repository turns a violation into BoothUnavailable.

import {
  Forbidden,
  BoothNotBookable,
  BackdropNotAvailable,
  InvalidPackage,
  InvalidEventDate,
  BookingCancelled,
} from "./errors.js";

export const PENDING_PAYMENT = "pending_payment";
export const CONFIRMED = "confirmed";
export const CANCELLED = "cancelled";

export const STAFF = "staff";
export const PACKAGES = ["digital_only", "digital_plus_prints"];
export const DEPOSIT_CENTS = 15000;

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // catches things like 2026-02-31
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export class Booking {
  constructor({
    id = null,
    customerId,
    boothId,
    backdropId,
    eventDate,
    pkg,
    status = PENDING_PAYMENT,
    depositCents = DEPOSIT_CENTS,
    createdAt = null,
    cancelledAt = null,
  }) {
    this.id = id;
    this.customerId = customerId;
    this.boothId = boothId;
    this.backdropId = backdropId;
    this.eventDate = eventDate;
    this.pkg = pkg;
    this.status = status;
    this.depositCents = depositCents;
    this.createdAt = createdAt;
    this.cancelledAt = cancelledAt;
  }

  // booth and backdrop are loaded by the repository and passed in
  static create({ customerId, booth, backdrop, eventDate, pkg, today }) {
    if (!booth || !booth.active) throw new BoothNotBookable();
    if (!backdrop || !backdrop.active) throw new BackdropNotAvailable();
    if (!PACKAGES.includes(pkg)) throw new InvalidPackage();
    if (!isValidDate(eventDate) || eventDate <= today) throw new InvalidEventDate();

    return new Booking({
      customerId,
      boothId: booth.id,
      backdropId: backdrop.id,
      eventDate,
      pkg,
    });
  }

  // ids from postgres BIGINT come back as strings, so compare as strings
  isOwnedBy(actor) {
    return String(actor.id) === String(this.customerId);
  }

  canBeViewedBy(actor) {
    return actor.role === STAFF || this.isOwnedBy(actor);
  }

  cancel(actor, now) {
    if (!this.canBeViewedBy(actor)) throw new Forbidden();
    // cancelling twice ends in the same state, so just return
    if (this.status === CANCELLED) return;
    this.status = CANCELLED;
    this.cancelledAt = now;
  }

  confirmPayment() {
    // payment came in after the booking was cancelled (e.g. it expired)
    if (this.status === CANCELLED) throw new BookingCancelled();
    this.status = CONFIRMED;
  }
}
