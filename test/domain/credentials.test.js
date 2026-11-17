import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, checkPassword } from "../../src/domain/credentials.js";
import { InvalidEmail, InvalidPassword } from "../../src/domain/errors.js";

test("email is trimmed and lowercased", () => {
  assert.equal(normalizeEmail("  Ana@Example.COM "), "ana@example.com");
});

test("rejects emails that are not a string, have no @ or domain dot, have spaces, or are too long", () => {
  const bad = [undefined, null, 5, {}, [], "", "ana", "ana@", "@x.com", "ana@x", "a na@x.com", "a@@x.com", `${"a".repeat(250)}@x.com`];
  for (const b of bad) assert.throws(() => normalizeEmail(b), InvalidEmail, String(b));
});

test("an email of exactly 254 characters is fine", () => {
  const email = `${"a".repeat(64)}@${"b".repeat(185)}.com`; // 64 + 1 + 185 + 4
  assert.equal(email.length, 254);
  assert.equal(normalizeEmail(email), email);
});

test("accepts passwords of 8 characters up to 72 bytes", () => {
  for (const ok of ["12345678", "a".repeat(72), "é".repeat(36)]) assert.doesNotThrow(() => checkPassword(ok));
});

test("rejects a password that is not a string or is shorter than 8 characters", () => {
  for (const bad of [undefined, null, 12345678, {}, ["12345678"], "", "1234567"]) {
    assert.throws(() => checkPassword(bad), InvalidPassword, String(bad));
  }
});

test("the 72 limit counts bytes, not characters", () => {
  assert.throws(() => checkPassword("a".repeat(73)), InvalidPassword);
  // 37 x "é" is 37 characters but 74 bytes
  assert.throws(() => checkPassword("é".repeat(37)), InvalidPassword);
});
