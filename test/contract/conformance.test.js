// checks the running service against openapi.yaml. every response (status,
// content type, headers and body) is validated against what the spec says
// that operation returns, so the spec and the code can't drift apart.
// needs the docker db running. creates its own users and deletes them at the end.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { createApp, apiRouters } from "../../src/app.js";
import { pool } from "../../src/db/pool.js";
import docsRouter, { spec } from "../../src/routes/docs.js";

// --- spec helpers -----------------------------------------------------------

// a copy of the spec made once for checking responses:
// - each "#/..." ref becomes "spec#/...", because ajv resolves a ref against the
//   schema being compiled, not against the whole spec (registered below as "spec")
// - every object schema rejects properties the spec doesn't list, so a leaked
//   field (a stack trace, a password hash) fails. only the test is this strict:
//   the published spec stays open, so adding a field later isn't a breaking change
function forAjv(node) {
  if (Array.isArray(node)) return node.map(forAjv);
  if (node === null || typeof node !== "object") return node;
  const copy = {};
  for (const [key, value] of Object.entries(node)) copy[key] = key === "$ref" ? `spec${value}` : forAjv(value);
  if (copy.type === "object" && copy.properties && !("additionalProperties" in copy)) copy.additionalProperties = false;
  return copy;
}
const checked = forAjv(spec);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(checked, "spec");

// follows { $ref: "spec#/components/..." } to the object it points at
function deref(node) {
  while (node?.$ref) node = node.$ref.slice("spec#/".length).split("/").reduce((obj, key) => obj[key], checked);
  return node;
}

// "/bookings/{id}/cancel" -> the operation object, or undefined
function operation(method, specPathName) {
  return checked.paths[specPathName]?.[method.toLowerCase()];
}

// --- the call + check -------------------------------------------------------

let baseUrl;

// sends a real http request, then checks the response against the spec.
// returns { status, body, headers } so a test can also check the values
async function call(method, specPathName, { path: urlPath = specPathName, user, body, raw, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (user) init.headers["X-User-Id"] = String(user.id);
  if (raw !== undefined || body !== undefined) {
    init.headers["Content-Type"] ??= "application/json";
    init.body = raw ?? JSON.stringify(body);
  }

  const res = await fetch(baseUrl + urlPath, init);
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  const label = `${method} ${specPathName} -> ${res.status}`;

  const op = operation(method, specPathName);
  assert.ok(op, `${label}: operation is not in the spec`);

  const response = deref(op.responses[String(res.status)]);
  assert.ok(response, `${label}: status ${res.status} is not documented in the spec`);

  const mediaType = response.content?.["application/json"];
  if (mediaType) {
    assert.match(res.headers.get("content-type") ?? "", /application\/json/, `${label}: content type`);
    const validate = ajv.compile(mediaType.schema); // ajv caches by schema object
    assert.ok(validate(json), `${label}: body does not match the spec: ${JSON.stringify(validate.errors)}\nbody: ${text}`);
  }

  for (const [name, header] of Object.entries(response.headers ?? {})) {
    const value = res.headers.get(name);
    assert.ok(value !== null, `${label}: documented header ${name} is missing`);
    const validate = ajv.compile(deref(header).schema);
    assert.ok(validate(value), `${label}: header ${name}="${value}" does not match the spec`);
  }

  return { status: res.status, body: json, headers: res.headers };
}

// --- test data --------------------------------------------------------------

const run = Date.now();
let server, ana, kim, staff;

async function makeUser(name, role = "customer") {
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', $2) RETURNING id",
    [`${name}-${run}@contract.test`, role]
  );
  return { id: rows[0].id, role };
}

function newBooking(eventDate, extra = {}) {
  return { boothId: "booth_dslr_01", backdropId: "backdrop_pillowcase_blue", eventDate, package: "digital_only", ...extra };
}

before(async () => {
  ana = await makeUser("ana");
  kim = await makeUser("kim");
  staff = await makeUser("staff", "staff");
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  const ids = [ana.id, kim.id, staff.id];
  await pool.query("DELETE FROM idempotency_keys WHERE customer_id = ANY($1)", [ids]);
  await pool.query("DELETE FROM bookings WHERE customer_id = ANY($1)", [ids]);
  await pool.query("DELETE FROM users WHERE id = ANY($1)", [ids]);
  await pool.end();
});

// --- the spec describes exactly the routes that exist -----------------------

// turns express's "/:id/cancel" into the spec's "/{id}/cancel"
function routesOf(router, prefix) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => {
        const p = (prefix + layer.route.path).replace(/:(\w+)/g, "{$1}").replace(/\/+/g, "/").replace(/(.)\/$/, "$1");
        return `${method.toUpperCase()} ${p}`;
      })
    );
}

test("the app mounts only the docs router and the routers listed in apiRouters", () => {
  // a router mounted any other way would skip the route check below
  const app = createApp();
  const mounted = app.router.stack.filter((layer) => Array.isArray(layer.handle.stack)).map((layer) => layer.handle);
  assert.deepEqual(mounted, [docsRouter, ...apiRouters.map((r) => r.router)]);
  assert.equal(app.router.stack.filter((layer) => layer.route).length, 0, "routes defined directly on the app");
});

test("every route in the code is in the spec, and every operation in the spec has a route", () => {
  const inCode = apiRouters.flatMap(({ prefix, router }) => routesOf(router, prefix)).sort();
  const inSpec = Object.entries(spec.paths)
    .flatMap(([p, ops]) => Object.keys(ops).map((method) => `${method.toUpperCase()} ${p}`))
    .sort();
  assert.deepEqual(inSpec, inCode);
});

// --- public endpoints -------------------------------------------------------

test("GET /health", async () => {
  const { body } = await call("GET", "/health");
  assert.deepEqual(body, { status: "ok", db: "up" });
});

test("GET /booths and /backdrops list active items only", async () => {
  const booths = await call("GET", "/booths");
  assert.ok(booths.body.length > 0 && booths.body.every((b) => b.active));
  const backdrops = await call("GET", "/backdrops");
  assert.ok(backdrops.body.length > 0 && backdrops.body.every((b) => b.active));
});

test("GET /booths/{id}/availability: free, unknown booth, bad date", async () => {
  const free = await call("GET", "/booths/{id}/availability", {
    path: "/booths/booth_dslr_01/availability?date=2094-02-01",
  });
  assert.equal(free.body.available, true);

  await call("GET", "/booths/{id}/availability", { path: "/booths/nope/availability?date=2094-02-01" }); // 404
  await call("GET", "/booths/{id}/availability", { path: "/booths/booth_dslr_01/availability?date=2094-02-31" }); // 422
  await call("GET", "/booths/{id}/availability", { path: "/booths/booth_dslr_01/availability" }); // 422
});

// --- POST /bookings ---------------------------------------------------------

test("POST /bookings: 201, then the date shows as taken", async () => {
  const created = await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-01") });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "pending_payment");
  assert.equal(created.body.cancelledAt, null);

  const taken = await call("GET", "/booths/{id}/availability", {
    path: "/booths/booth_dslr_01/availability?date=2094-03-01",
  });
  assert.equal(taken.body.available, false);
});

test("POST /bookings: same date again is 409 booth_unavailable", async () => {
  await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-02") });
  const second = await call("POST", "/bookings", { user: kim, body: newBooking("2094-03-02") });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "booth_unavailable");
});

test("POST /bookings: idempotent replay is 200 with the Idempotent-Replayed header", async () => {
  const headers = { "Idempotency-Key": `contract-${run}-a` };
  const first = await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-03"), headers });
  const replay = await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-03"), headers });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("Idempotent-Replayed"), "true");
  assert.equal(replay.body.id, first.body.id);
});

test("POST /bookings: same key with a different body is 422 idempotency_key_reused", async () => {
  const headers = { "Idempotency-Key": `contract-${run}-b` };
  await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-04"), headers });
  const reused = await call("POST", "/bookings", { user: ana, body: newBooking("2094-03-05"), headers });
  assert.equal(reused.status, 422);
  assert.equal(reused.body.error.code, "idempotency_key_reused");
});

test("POST /bookings: validation errors are 422 with the right code", async () => {
  const cases = [
    [newBooking("2094-03-06", { package: "gold" }), "invalid_package"],
    [newBooking("2020-01-01"), "invalid_event_date"],
    [newBooking("2094-02-31"), "invalid_event_date"],
    [newBooking("2094-03-06", { boothId: "nope" }), "booth_not_bookable"],
    [newBooking("2094-03-06", { backdropId: "nope" }), "backdrop_not_available"],
    [{}, "booth_not_bookable"],
  ];
  for (const [body, code] of cases) {
    const res = await call("POST", "/bookings", { user: ana, body });
    assert.equal(res.status, 422, code);
    assert.equal(res.body.error.code, code);
  }
});

test("POST /bookings: invalid JSON is 400 invalid_json", async () => {
  const res = await call("POST", "/bookings", { user: ana, raw: "{not json" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "invalid_json");
});

test("POST /bookings: a body over 100 KB is 413 and an unknown charset is 415, never 500", async () => {
  const big = await call("POST", "/bookings", { user: ana, raw: JSON.stringify({ x: "a".repeat(200_000) }) });
  assert.equal(big.status, 413);
  assert.equal(big.body.error.code, "invalid_body");

  const charset = await call("POST", "/bookings", {
    user: ana,
    raw: "{}",
    headers: { "Content-Type": "application/json; charset=latin9" },
  });
  assert.equal(charset.status, 415);
  assert.equal(charset.body.error.code, "invalid_body");
});

test("auth is checked before the body is read: bad JSON with no X-User-Id is 401", async () => {
  assert.equal((await call("POST", "/bookings", { raw: "{not json" })).status, 401);
  assert.equal((await call("PATCH", "/bookings/{id}/cancel", { path: "/bookings/1/cancel", raw: "{not json" })).status, 401);
});

test("protected operations: missing, malformed and unknown X-User-Id are 401", async () => {
  for (const id of [undefined, "abc", "999999999", "99999999999999999999"]) {
    const user = id === undefined ? undefined : { id };
    const res = await call("GET", "/bookings", { user });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "unauthenticated");
  }
  assert.equal((await call("POST", "/bookings", { body: newBooking("2094-03-07") })).status, 401);
  assert.equal((await call("GET", "/bookings/{id}", { path: "/bookings/1" })).status, 401);
  assert.equal((await call("PATCH", "/bookings/{id}/cancel", { path: "/bookings/1/cancel" })).status, 401);
});

// regression for the old fakeAuth, which trusted an X-User-Role header. keep this
// test when the real auth replaces X-User-Id: only how the user is sent changes
test("the role comes from the database: a customer sending X-User-Role: staff is still a customer", async () => {
  const { body: kims } = await call("POST", "/bookings", { user: kim, body: newBooking("2094-04-05") });
  const asStaff = { user: ana, headers: { "X-User-Role": "staff" } };

  const list = await call("GET", "/bookings", asStaff);
  assert.ok(list.body.every((b) => b.customerId === String(ana.id)), "saw other customers' bookings");

  const other = await call("GET", "/bookings/{id}", { ...asStaff, path: `/bookings/${kims.id}` });
  assert.equal(other.status, 403);
  const cancel = await call("PATCH", "/bookings/{id}/cancel", { ...asStaff, path: `/bookings/${kims.id}/cancel` });
  assert.equal(cancel.status, 403);
});

// --- reading and cancelling -------------------------------------------------

test("GET /bookings: customers see their own, staff see everyone's", async () => {
  const mine = await call("POST", "/bookings", { user: ana, body: newBooking("2094-04-01") });
  await call("POST", "/bookings", { user: kim, body: newBooking("2094-04-02") });

  const anaList = await call("GET", "/bookings", { user: ana });
  assert.ok(anaList.body.some((b) => b.id === mine.body.id));
  assert.ok(anaList.body.every((b) => b.customerId === String(ana.id)));

  const staffList = await call("GET", "/bookings", { user: staff });
  const owners = new Set(staffList.body.map((b) => b.customerId));
  assert.ok(owners.has(String(ana.id)) && owners.has(String(kim.id)));
});

test("GET /bookings/{id}: owner and staff 200, another customer 403, bad id 422, missing 404", async () => {
  const { body: booking } = await call("POST", "/bookings", { user: ana, body: newBooking("2094-04-03") });
  const at = (id) => ({ path: `/bookings/${id}` });

  assert.equal((await call("GET", "/bookings/{id}", { ...at(booking.id), user: ana })).status, 200);
  assert.equal((await call("GET", "/bookings/{id}", { ...at(booking.id), user: staff })).status, 200);

  const forbidden = await call("GET", "/bookings/{id}", { ...at(booking.id), user: kim });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, "forbidden");

  const bad = await call("GET", "/bookings/{id}", { ...at("abc"), user: ana });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error.code, "invalid_id");

  const missing = await call("GET", "/bookings/{id}", { ...at("999999999"), user: ana });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "not_found");
});

test("PATCH /bookings/{id}/cancel: owner cancels and the date frees up, twice is fine, others get 403", async () => {
  const { body: booking } = await call("POST", "/bookings", { user: ana, body: newBooking("2094-04-04") });
  const at = (id) => ({ path: `/bookings/${id}/cancel` });

  const forbidden = await call("PATCH", "/bookings/{id}/cancel", { ...at(booking.id), user: kim });
  assert.equal(forbidden.status, 403);

  const cancelled = await call("PATCH", "/bookings/{id}/cancel", { ...at(booking.id), user: ana });
  assert.equal(cancelled.body.status, "cancelled");
  assert.ok(cancelled.body.cancelledAt);

  const again = await call("PATCH", "/bookings/{id}/cancel", { ...at(booking.id), user: ana });
  assert.equal(again.status, 200);

  // the date is free again
  const rebook = await call("POST", "/bookings", { user: kim, body: newBooking("2094-04-04") });
  assert.equal(rebook.status, 201);

  assert.equal((await call("PATCH", "/bookings/{id}/cancel", { ...at("abc"), user: ana })).status, 422);
  assert.equal((await call("PATCH", "/bookings/{id}/cancel", { ...at("999999999"), user: ana })).status, 404);
});
