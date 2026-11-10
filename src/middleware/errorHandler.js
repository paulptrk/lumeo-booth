import { HttpError } from "../errors.js";

export function notFound(req, res) {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // bad json body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
  }

  // never send stack traces to the client
  console.error(err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}
