// turns an api result into a one-line description. no dom code here.

export function describe(result) {
  const body = result.body;
  if (body?.error) return `${body.error.code}: ${body.error.message}`;
  if (body?.id) return `booking ${body.id} (${body.status})${result.replayed ? ", replayed" : ""}`;
  return "";
}

export function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
