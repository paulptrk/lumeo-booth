// needs the docker db running. creates two throwaway users and deletes them at the end.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loadConfig } from "../../src/config.js";
import { register, resolveActor } from "../../src/services/authService.js";
import { EmailTaken, Unauthenticated } from "../../src/domain/errors.js";

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
  await pool.query("DELETE FROM users WHERE id = ANY($1) OR email LIKE $2", [[customer, staff], `%-${run}@register.test`]);
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

// every malformed shape is in test/domain/ids.test.js. these two check the guard is
// used at all: without it postgres throws 22P02 / 22003 and the api would return 500
test("a malformed or oversized id is Unauthenticated, not a postgres error", async () => {
  await assert.rejects(resolveActor("abc"), Unauthenticated);
  await assert.rejects(resolveActor("9223372036854775808"), Unauthenticated); // max bigint + 1
});

test("unknown numeric id is Unauthenticated", async () => {
  await assert.rejects(resolveActor("999999999"), Unauthenticated);
});

test("register stores a bcrypt hash of the password and makes a customer", async () => {
  const email = `new-${run}@register.test`;
  await register(email, "correct-horse");
  const { rows } = await pool.query("SELECT password_hash, role FROM users WHERE email = $1", [email]);
  assert.notEqual(rows[0].password_hash, "correct-horse");
  assert.equal(await bcrypt.compare("correct-horse", rows[0].password_hash), true);
  assert.equal(rows[0].role, "customer");
});

test("register returns a token signed with the secret, carrying the user id and role", async () => {
  const { token } = await register(`token-${run}@register.test`, "correct-horse");
  const claims = jwt.verify(token, loadConfig().jwtSecret, { algorithms: ["HS256"] });
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [`token-${run}@register.test`]);
  assert.equal(claims.sub, String(rows[0].id));
  assert.equal(claims.role, "customer");
  assert.equal(claims.exp - claims.iat, 3600);
});

test("register with an email that is taken is EmailTaken, whatever its case", async () => {
  await register(`dup-${run}@register.test`, "correct-horse");
  await assert.rejects(register(`dup-${run}@register.test`, "another-pass"), EmailTaken);
  await assert.rejects(register(`DUP-${run}@Register.test`, "another-pass"), EmailTaken);
});
