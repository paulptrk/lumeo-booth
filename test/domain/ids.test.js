import { test } from "node:test";
import assert from "node:assert/strict";
import { isId } from "../../src/domain/ids.js";

test("accepts positive whole numbers up to the bigint max", () => {
  for (const ok of ["1", "42", "9223372036854775807", 7, 7n]) assert.equal(isId(ok), true, String(ok));
});

test("rejects everything else", () => {
  const bad = [
    "", "0", "-1", "+1", "007", "1.5", "1e3", " 1", "1 ", "abc", "1; DROP TABLE users",
    "9223372036854775808", "99999999999999999999",
    undefined, null, {}, [], ["1"], true, 1.5, -1, NaN,
  ];
  for (const b of bad) assert.equal(isId(b), false, String(JSON.stringify(b) ?? b));
});
