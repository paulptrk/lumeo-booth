// ids are BIGINT. anything that isn't digits, or is too big for a bigint,
// can't match and would make postgres throw (22P02 / 22003), so we say no first
const MAX_BIGINT = 9223372036854775807n;

export function isId(id) {
  const s = String(id);
  return /^\d{1,19}$/.test(s) && BigInt(s) <= MAX_BIGINT;
}
