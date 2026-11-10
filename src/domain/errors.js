// domain errors only carry a code. the interface layer decides the http status.
// no imports in the domain folder.

export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.code = "domain_error";
  }
}

export class NotFound extends DomainError {
  constructor(message = "Not found") {
    super(message);
    this.code = "not_found";
  }
}

export class Forbidden extends DomainError {
  constructor(message = "Not allowed") {
    super(message);
    this.code = "forbidden";
  }
}
