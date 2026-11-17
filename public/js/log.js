// panel: the request log. lists every (non-quiet) api call, newest first.

import { onRequest } from "./api.js";
import { describe } from "./format.js";
import { $, el, statusPill } from "./dom.js";

const MAX_ENTRIES = 60;

function entry(result) {
  const summary = el("summary", {},
    statusPill(result.status),
    el("code", {}, `${result.method} ${result.path}`),
    result.replayed ? el("span", { class: "pill muted" }, "Idempotent-Replayed") : "",
    el("span", { class: "muted" }, describe(result)),
    el("span", { class: "muted" }, `${result.ms} ms`));
  const keyLine = result.key ? `Idempotency-Key: ${result.key}\n\n` : "";
  return el("details", {}, summary, el("pre", {}, keyLine + JSON.stringify(result.body, null, 2)));
}

export function initLog() {
  const log = $("log");
  onRequest((result) => {
    log.prepend(entry(result));
    while (log.children.length > MAX_ENTRIES) log.lastChild.remove();
  });
}
