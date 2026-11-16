// what a valid id looks like. ids are postgres BIGINT identity values, so a
// valid one is a positive whole number with no sign, spaces or leading zeros
// that fits in 64 bits. anything else can never match a row and would make
// postgres throw (22P02 / 22003), so the services reject it before it gets near
// the db. ids arrive as strings (headers, url params, and pg returns BIGINT as a
// string). no express or sql here.

const MAX_BIGINT = 9223372036854775807n;

export function isId(id) {
  return typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= MAX_BIGINT;
}
