// concurrency proof for the demo: many requests for the same booth and date at
// the same moment, and only one can win.
//
//   scenario A  10 different requests (10 keys) for one booth + date
//               -> exactly one 201, the other nine are 409 booth_unavailable
//   scenario B  the same request (same Idempotency-Key) sent 10 times at once
//               -> exactly one 201, the other nine are 200 replays of that booking
//
// why it holds: there is no "is it free?" check followed by an insert (that
// leaves a gap two requests can both slip through). the insert itself is the
// check: the unique partial index bookings_one_active_per_booth_date lets
// postgres admit one row per booth and date, and the losers get a unique
// violation that the repository turns into 409. in scenario B the idempotency
// key's primary key does the same job: concurrent requests with one key wait
// for the first to commit, then see its booking and replay it.
//
// run it against the running app:  npm run demo:concurrency
// (BASE_URL defaults to http://localhost:3000, REQUESTS to 10)

import crypto from "node:crypto";
import { pool } from "../src/db/pool.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const N = Number(process.env.REQUESTS ?? 10);
const BOOTH = "booth_dslr_01";
const BACKDROP = "backdrop_pillowcase_blue";

// --- helpers ----------------------------------------------------------------

// a date far in the future, so it can't clash with real bookings or past runs
function randomFutureDate() {
  const year = crypto.randomInt(2090, 2100);
  const month = crypto.randomInt(1, 13);
  const day = crypto.randomInt(1, 29);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function pickFreeDate(customerId) {
  for (let i = 0; i < 20; i++) {
    const date = randomFutureDate();
    const res = await fetch(`${BASE_URL}/booths/${BOOTH}/availability?date=${date}`, {
      headers: { "X-User-Id": String(customerId) },
    });
    if ((await res.json()).available) return date;
  }
  throw new Error("could not find a free date");
}

async function sendBooking(customerId, date, key) {
  const started = performance.now();
  const res = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "X-User-Id": String(customerId), "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ boothId: BOOTH, backdropId: BACKDROP, eventDate: date, package: "digital_only" }),
  });
  const body = await res.json();
  return {
    status: res.status,
    replayed: res.headers.get("Idempotent-Replayed") === "true",
    bookingId: body.id ?? null,
    code: body.error?.code ?? null,
    ms: Math.round(performance.now() - started),
  };
}

// builds all the requests first, then starts them in the same tick
function fireAll(customerId, date, keys) {
  return Promise.all(keys.map((key) => sendBooking(customerId, date, key)));
}

function printTable(title, date, results) {
  console.log(`\n${title}  (${BOOTH} on ${date})`);
  console.log("  #   status   result                          ms");
  results.forEach((r, i) => {
    const result = r.bookingId
      ? `booking ${r.bookingId}${r.replayed ? " (replay)" : " (created)"}`
      : r.code;
    console.log(`  ${String(i + 1).padStart(2)}  ${String(r.status).padEnd(7)}  ${result.padEnd(30)}  ${r.ms}`);
  });
}

function countBy(results, status) {
  return results.filter((r) => r.status === status).length;
}

const failures = [];
function check(ok, label) {
  console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures.push(label);
}

async function activeRows(date) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM bookings WHERE booth_id = $1 AND event_date = $2 AND status <> 'cancelled'",
    [BOOTH, date]
  );
  return rows[0].n;
}

async function cancelBooking(customerId, id) {
  await fetch(`${BASE_URL}/bookings/${id}/cancel`, { method: "PATCH", headers: { "X-User-Id": String(customerId) } });
}

// --- the demo ---------------------------------------------------------------

async function main() {
  const { rows } = await pool.query("SELECT id FROM users WHERE email = 'customer@lumeo.dev'");
  if (!rows[0]) throw new Error("dev customer not found. run: npm run seed (or npm run seed:docker)");
  const customerId = rows[0].id;

  console.log(`firing ${N} simultaneous requests per scenario at ${BASE_URL}`);
  const created = [];

  // A: different keys, same booth and date
  const dateA = await pickFreeDate(customerId);
  const keysA = Array.from({ length: N }, () => crypto.randomUUID());
  const a = await fireAll(customerId, dateA, keysA);
  printTable(`Scenario A: ${N} different requests for the same booth and date`, dateA, a);
  console.log("");
  check(countBy(a, 201) === 1, `exactly one 201 (got ${countBy(a, 201)})`);
  check(countBy(a, 409) === N - 1, `the other ${N - 1} are 409 (got ${countBy(a, 409)})`);
  check(a.filter((r) => r.status === 409).every((r) => r.code === "booth_unavailable"), "every 409 is booth_unavailable");
  check((await activeRows(dateA)) === 1, "database holds exactly one active booking for that booth and date");
  created.push(...a.filter((r) => r.status === 201).map((r) => r.bookingId));

  // B: one key sent N times at once
  const dateB = await pickFreeDate(customerId);
  const sameKey = crypto.randomUUID();
  const b = await fireAll(customerId, dateB, Array(N).fill(sameKey));
  printTable(`Scenario B: the same request (same Idempotency-Key) sent ${N} times`, dateB, b);
  console.log("");
  check(countBy(b, 201) === 1, `exactly one 201 (got ${countBy(b, 201)})`);
  check(countBy(b, 200) === N - 1, `the other ${N - 1} are 200 replays (got ${countBy(b, 200)})`);
  check(b.filter((r) => r.status === 200).every((r) => r.replayed), "every 200 carries Idempotent-Replayed: true");
  check(new Set(b.map((r) => r.bookingId)).size === 1, "all responses return the same booking id");
  check((await activeRows(dateB)) === 1, "database holds exactly one booking for that date (no duplicates)");
  created.push(...b.filter((r) => r.status === 201).map((r) => r.bookingId));

  // cancelling frees the dates again, so the demo leaves nothing booked
  for (const id of created) await cancelBooking(customerId, id);
  console.log(`\ncleaned up: cancelled ${created.length} demo bookings`);
}

main()
  .catch((err) => {
    const unreachable = err.cause?.code === "ECONNREFUSED" || err.message === "fetch failed";
    console.error(unreachable ? `cannot reach ${BASE_URL}. is the app running? (npm run up)` : err.message);
    failures.push("script error");
  })
  .finally(async () => {
    await pool.end();
    if (failures.length) {
      console.log(`\n❌ FAILED (${failures.length}): ${failures.join("; ")}`);
      process.exitCode = 1;
    } else {
      console.log("\n✅ PASSED: no double booking under concurrency");
    }
  });
