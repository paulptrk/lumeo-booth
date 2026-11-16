// needs the docker db running. creates two throwaway users and deletes them at the end.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool.js";
import { resolveActor } from "../../src/services/authService.js";
import { Unauthenticated } from "../../src/domain/errors.js";

const run = Date.now();
let customer, staff;

async function makeUser(name, role) {
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', $2) RETURNING id",
    [`${name}-${run}@test.com`, role]
  );
  return String(rows[0].id);
}

before(async () => {
  customer = await makeUser("auth-customer", "customer");
  staff = await makeUser("auth-staff", "staff");
});

after(async () => {
  await pool.query("DELETE FROM users WHERE id = ANY($1)", [[customer, staff]]);
  await pool.end();
});

test("a real customer resolves to role customer, taken from the db", async () => {
  const actor = await resolveActor(customer);
  assert.equal(String(actor.id), customer);
  assert.equal(actor.role, "customer");
});

test("a real staff user resolves to role staff", async () => {
  const actor = await resolveActor(staff);
  assert.equal(actor.role, "staff");
});

test("missing id is Unauthenticated", async () => {
  await assert.rejects(resolveActor(undefined), Unauthenticated);
  await assert.rejects(resolveActor(""), Unauthenticated);
});

test("non-numeric id is Unauthenticated, not a postgres error", async () => {
  await assert.rejects(resolveActor("abc"), Unauthenticated);
  await assert.rejects(resolveActor("1; DROP TABLE users"), Unauthenticated);
  await assert.rejects(resolveActor("-1"), Unauthenticated);
});

test("digits that overflow a bigint are Unauthenticated, not a postgres range error", async () => {
  await assert.rejects(resolveActor("99999999999999999999"), Unauthenticated);
  await assert.rejects(resolveActor("9223372036854775808"), Unauthenticated); // max bigint + 1
});

test("unknown numeric id is Unauthenticated", async () => {
  await assert.rejects(resolveActor("999999999"), Unauthenticated);
});
