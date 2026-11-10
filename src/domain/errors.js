// domain errors only carry a code. the interface layer decides the http status.
// files in domain/ only import each other (no express, no sql).

export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class NotFound extends DomainError {
  constructor(message = "Not found") {
    super("not_found", message);
  }
}

export class Forbidden extends DomainError {
  constructor(message = "Not allowed") {
    super("forbidden", message);
  }
}

// booking errors

export class BoothUnavailable extends DomainError {
  constructor() {
    super("booth_unavailable", "This booth is already booked on that date");
  }
}

export class BoothNotBookable extends DomainError {
  constructor() {
    super("booth_not_bookable", "This booth doesn't exist or can't be booked");
  }
}

export class BackdropNotAvailable extends DomainError {
  constructor() {
    super("backdrop_not_available", "This backdrop doesn't exist or isn't available");
  }
}

export class InvalidPackage extends DomainError {
  constructor() {
    super("invalid_package", "Package must be digital_only or digital_plus_prints");
  }
}

export class InvalidEventDate extends DomainError {
  constructor() {
    super("invalid_event_date", "Event date must be a valid future date (YYYY-MM-DD)");
  }
}

export class BookingCancelled extends DomainError {
  constructor() {
    super("booking_cancelled", "This booking was cancelled");
  }
}

export class IdempotencyKeyReused extends DomainError {
  constructor() {
    super("idempotency_key_reused", "This Idempotency-Key was already used for a different request");
  }
}
