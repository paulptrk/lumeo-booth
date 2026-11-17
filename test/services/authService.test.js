// needs the docker db running. creates two throwaway users and deletes them at the end.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/db/pool.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loadConfig } from "../../src/config.js";
import { authenticate, login, register } from "../../src/services/authService.js";
import { EmailTaken, InvalidEmail, InvalidPassword, Unauthenticated } from "../../src/domain/errors.js";

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

test("login with the right password returns a token for that user", async () => {
  const email = `login-${run}@register.test`;
  await register(email, "correct-horse");
  const { rows } = await pool.query("SELECT id, role FROM users WHERE email = $1", [email]);
  const { token } = await login(` ${email.toUpperCase()} `, "correct-horse");
  const claims = jwt.verify(token, loadConfig().jwtSecret, { algorithms: ["HS256"] });
  assert.equal(claims.sub, String(rows[0].id));
  assert.equal(claims.role, rows[0].role);
});

test("login with a wrong password or an unknown email is the same Unauthenticated error", async () => {
  const email = `wrong-${run}@register.test`;
  await register(email, "correct-horse");
  const wrongPassword = await login(email, "not-the-password").catch((e) => e);
  const unknownEmail = await login(`nobody-${run}@register.test`, "correct-horse").catch((e) => e);
  assert.ok(wrongPassword instanceof Unauthenticated);
  assert.ok(unknownEmail instanceof Unauthenticated);
  assert.equal(wrongPassword.message, unknownEmail.message);
});

test("login with a missing or non-string email or password is a validation error", async () => {
  await assert.rejects(login(undefined, "correct-horse"), InvalidEmail);
  await assert.rejects(login(`x-${run}@register.test`, undefined), InvalidPassword);
  await assert.rejects(login(`x-${run}@register.test`, 12345678), InvalidPassword);
});

const secret = () => loadConfig().jwtSecret;
const bearer = (claims, key = secret(), options = { algorithm: "HS256", expiresIn: "1h" }) =>
  `Bearer ${jwt.sign(claims, key, options)}`;

test("authenticate returns the user for a valid token", async () => {
  const actor = await authenticate(bearer({ sub: staff, role: "staff" }));
  assert.equal(String(actor.id), staff);
  assert.equal(actor.role, "staff");
});

test("authenticate takes the role from the db, not from the token", async () => {
  const actor = await authenticate(bearer({ sub: customer, role: "staff" }));
  assert.equal(actor.role, "customer");
});

test("authenticate with a missing header or the wrong scheme is Unauthenticated", async () => {
  await assert.rejects(authenticate(undefined), Unauthenticated);
  await assert.rejects(authenticate(bearer({ sub: customer }).replace("Bearer", "Basic")), Unauthenticated);
});

test("authenticate rejects a bad token with one generic message", async () => {
  const valid = bearer({ sub: customer });
  const tampered = valid.slice(0, -2) + (valid.endsWith("AA") ? "BB" : "AA");
  const bad = [
    tampered,
    bearer({ sub: customer }, "another-secret-that-is-long-enough-123"),
    bearer({ sub: customer }, secret(), { algorithm: "HS256", expiresIn: -10 }),
    bearer({ sub: customer }, secret(), { algorithm: "HS512" }),
    `Bearer ${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(`{"sub":"${customer}"}`).toString("base64url")}.`,
    "Bearer not-a-token",
    bearer({ sub: "abc" }),
  ];
  for (const header of bad) {
    await assert.rejects(authenticate(header), (e) => e instanceof Unauthenticated && e.message === "Invalid or expired token");
  }
});

test("authenticate rejects a valid token whose user no longer exists", async () => {
  const gone = await makeUser("auth-gone", "customer");
  const header = bearer({ sub: gone });
  await pool.query("DELETE FROM users WHERE id = $1", [gone]);
  await assert.rejects(authenticate(header), Unauthenticated);
});
