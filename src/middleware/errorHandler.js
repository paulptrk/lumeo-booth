import { DomainError } from "../domain/errors.js";

// error code -> http status. every DomainError code needs an entry here, and in
// the Error code enum in openapi.yaml (test/middleware/errorHandler.test.js checks both)
export const STATUS = {
  unauthenticated: 401,
  invalid_id: 422,
  not_found: 404,
  forbidden: 403,
  booth_unavailable: 409,
  booking_cancelled: 409,
  booth_not_bookable: 422,
  backdrop_not_available: 422,
  invalid_package: 422,
  invalid_event_date: 422,
  idempotency_key_required: 422,
  idempotency_key_reused: 422,
  invalid_email: 422,
  invalid_password: 422,
  email_taken: 409,
};

function send(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

export function notFound(req, res) {
  send(res, 404, "not_found", "Route not found");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // a stored error sent back for a retried Idempotency-Key
  if (err.replayed) res.set("Idempotent-Replayed", "true");

  if (err instanceof DomainError && STATUS[err.code]) {
    return send(res, STATUS[err.code], err.code, err.message);
  }

  // errors from express.json(): bad json, body too large (413), unsupported
  // charset or encoding (415). body-parser marks the client's mistakes with
  // expose and a 4xx status, and their messages are safe to show
  if (err.type === "entity.parse.failed") {
    return send(res, 400, "invalid_json", "Request body is not valid JSON");
  }
  if (err.expose && err.status >= 400 && err.status < 500) {
    return send(res, err.status, "invalid_body", err.message);
  }

  // anything else is our bug, including a DomainError missing from STATUS.
  // never send stack traces to the client
  console.error(err);
  send(res, 500, "internal_error", "Something went wrong");
}
