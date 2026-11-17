import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const SECRET = "x".repeat(32);

test("a missing JWT_SECRET throws", () => {
  assert.throws(() => loadConfig({}), /JWT_SECRET is not set/);
  assert.throws(() => loadConfig({ JWT_SECRET: "" }), /JWT_SECRET is not set/);
});

test("a JWT_SECRET shorter than 32 characters throws", () => {
  assert.throws(() => loadConfig({ JWT_SECRET: "change-me" }), /at least 32/);
  assert.throws(() => loadConfig({ JWT_SECRET: "x".repeat(31) }), /at least 32/);
});

test("a valid secret returns the config, expiry defaults to 1h", () => {
  assert.deepEqual(loadConfig({ JWT_SECRET: SECRET }), { jwtSecret: SECRET, jwtExpiresIn: "1h" });
});

test("JWT_EXPIRES_IN overrides the default", () => {
  assert.equal(loadConfig({ JWT_SECRET: SECRET, JWT_EXPIRES_IN: "15m" }).jwtExpiresIn, "15m");
});
