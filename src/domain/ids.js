// what a valid id looks like. ids are postgres BIGINT identity values, so a
// valid one is a positive whole number with no sign, spaces or leading zeros
// that fits in 64 bits. anything else can never match a row and would make
// postgres throw (22P02 / 22003), so we reject it before it gets near the db.
// no express or sql here.

const MAX_BIGINT = 9223372036854775807n;

export function isId(id) {
  if (typeof id !== "string" && typeof id !== "number" && typeof id !== "bigint") return false;
  const s = String(id);
  return /^[1-9]\d{0,18}$/.test(s) && BigInt(s) <= MAX_BIGINT;
}
