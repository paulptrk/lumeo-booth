// no db needed. calls the error handler with a fake response.

import { test } from "node:test";
import assert from "node:assert/strict";
import { errorHandler, STATUS } from "../../src/middleware/errorHandler.js";
import { spec } from "../../src/routes/docs.js";
import * as errors from "../../src/domain/errors.js";

function run(err) {
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

const domainCodes = Object.values(errors)
  .filter((E) => E.prototype instanceof errors.DomainError)
  .map((E) => new E().code);

test("every domain error is a 4xx, so a new one can't silently fall through", () => {
  for (const code of domainCodes) {
    assert.ok(STATUS[code] >= 400 && STATUS[code] < 500, `${code} is missing from STATUS`);
  }
});

test("the spec's error code enum lists exactly the codes the api can send", () => {
  const inSpec = spec.components.schemas.Error.properties.error.properties.code.enum;
  const sent = [...Object.keys(STATUS), "invalid_json", "invalid_body", "internal_error"];
  assert.deepEqual([...inSpec].sort(), sent.sort());
});

test("a domain error becomes { error: { code, message } } and nothing else", () => {
  const res = run(new errors.InvalidId());
  assert.equal(res.code, 422);
  assert.deepEqual(Object.keys(res.body.error).sort(), ["code", "message"]);
  assert.equal(res.body.error.code, "invalid_id");
});

test("body-parser errors are the client's fault: 400, 413, 415, never 500", () => {
  assert.equal(run({ type: "entity.parse.failed", expose: true, status: 400 }).body.error.code, "invalid_json");
  const tooLarge = run({ type: "entity.too.large", expose: true, status: 413, message: "request entity too large" });
  assert.deepEqual([tooLarge.code, tooLarge.body.error.code], [413, "invalid_body"]);
  assert.equal(run({ type: "charset.unsupported", expose: true, status: 415, message: "x" }).code, 415);
});

test("an unmapped domain error or a plain Error is a 500 with no details", (t) => {
  t.mock.method(console, "error", () => {});
  for (const err of [new errors.DomainError("made_up", "secret detail"), new Error("secret detail")]) {
    const res = run(err);
    assert.equal(res.code, 500);
    assert.deepEqual(res.body, { error: { code: "internal_error", message: "Something went wrong" } });
  }
});
