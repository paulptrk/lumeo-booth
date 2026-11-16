// no db needed. calls the error handler with a fake response.

import { test } from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { InvalidId, Unauthenticated, NotFound, BoothUnavailable } from "../../src/domain/errors.js";

function run(err) {
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

test("domain errors map to the right client error status", () => {
  assert.equal(run(new InvalidId()).code, 422);
  assert.equal(run(new Unauthenticated()).code, 401);
  assert.equal(run(new NotFound()).code, 404);
  assert.equal(run(new BoothUnavailable()).code, 409);
});

test("a malformed id is a 4xx with the invalid_id code and no stack", () => {
  const res = run(new InvalidId());
  assert.ok(res.code >= 400 && res.code < 500);
  assert.deepEqual(Object.keys(res.body.error).sort(), ["code", "message"]);
  assert.equal(res.body.error.code, "invalid_id");
});
