import { DomainError } from "../domain/errors.js";

// error code -> http status. add new codes here when you add a domain error
const STATUS = {
  not_found: 404,
  forbidden: 403,
  booth_unavailable: 409,
  booking_cancelled: 409,
  booth_not_bookable: 422,
  backdrop_not_available: 422,
  invalid_package: 422,
  invalid_event_date: 422,
  idempotency_key_reused: 422,
};

export function notFound(req, res) {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof DomainError) {
    const status = STATUS[err.code] ?? 400;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }

  // bad json body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
  }

  // never send stack traces to the client
  console.error(err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}
