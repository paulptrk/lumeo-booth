// rules for the email and password of a new account. no express or sql here.

import { InvalidEmail, InvalidPassword } from "./errors.js";

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes, so a longer password would be silently cut
const MAX_PASSWORD_BYTES = 72;

// returns the email trimmed and lowercased, so "Ana@x.com" and "ana@x.com" are one account
export function normalizeEmail(raw) {
  if (typeof raw !== "string") throw new InvalidEmail();
  const email = raw.trim().toLowerCase();
  // just a shape check (something@something.something), not a full email parser
  if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InvalidEmail();
  }
  return email;
}

// the length is in characters, the limit is in bytes (an emoji is 1 character but 4 bytes)
export function checkPassword(raw) {
  if (typeof raw !== "string" || raw.length < MIN_PASSWORD_LENGTH) throw new InvalidPassword();
  if (new TextEncoder().encode(raw).length > MAX_PASSWORD_BYTES) throw new InvalidPassword();
}
