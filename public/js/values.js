// generated form values: idempotency keys and dates. no dom code here.

export function newKey() {
  // randomUUID only exists on https or localhost
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const pad = (n) => String(n).padStart(2, "0");

// a date far in the future, so a race can't clash with real bookings
export function randomFarDate() {
  const between = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo));
  return `${between(2090, 2100)}-${pad(between(1, 13))}-${pad(between(1, 29))}`;
}

export function dateInDays(days) {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
