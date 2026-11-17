// panel: fire many bookings for one booth and date at the same moment and show
// that the server lets only one through (or, with one shared key, replays it).

import * as api from "./api.js";
import { describe } from "./format.js";
import { $, el, statusPill } from "./dom.js";
import { newKey, randomFarDate } from "./values.js";
import { bookingInput } from "./booking.js";

function keysFor(count, mode) {
  const shared = newKey();
  return Array.from({ length: count }, () => (mode === "same" ? shared : newKey()));
}

function showTable(results) {
  const table = $("race-table");
  table.hidden = false;
  table.tBodies[0].replaceChildren(...results.map((r, i) =>
    el("tr", {}, el("td", {}, i + 1), el("td", {}, statusPill(r.status)), el("td", {}, describe(r)), el("td", {}, r.ms))));
}

function showSummary(results, date) {
  const count = (status) => results.filter((r) => r.status === status).length;
  const replays = results.filter((r) => r.replayed).length;
  const created = new Set(results.filter((r) => r.body?.id).map((r) => r.body.id)).size;
  const ok = created <= 1;
  $("race-summary").replaceChildren(
    el("b", {}, `${count(201)} × 201`), `, ${count(409)} × 409`, replays ? `, ${replays} replays` : "",
    `, ${created} booking${created === 1 ? "" : "s"} created for ${date}. `,
    el("span", { class: ok ? "s2" : "bad" }, ok ? "No double booking." : "Double booking!"));
}

async function race(onDone) {
  const button = $("race");
  button.disabled = true;
  const count = Math.max(2, Math.min(50, Number($("race-n").value) || 10));
  const date = $("race-date").value;
  const keys = keysFor(count, $("race-mode").value);

  // every request is started before any is awaited
  const results = await Promise.all(keys.map((key) => api.createBooking(bookingInput(date), key)));

  showTable(results);
  showSummary(results, date);
  $("race-date").value = randomFarDate(); // the next race gets a fresh date
  button.disabled = false;
  onDone();
}

export function initRace({ onDone }) {
  $("race-date").value = randomFarDate();
  $("race-date-new").onclick = () => {
    $("race-date").value = randomFarDate();
  };
  $("race").onclick = () => race(onDone);
}
