// panel: the bookings table with a cancel button per booking. the server decides
// what's in it: customers get their own bookings, staff get everyone's.

import * as api from "./api.js";
import * as session from "./session.js";
import { describe, money } from "./format.js";
import { $, el, messageRow } from "./dom.js";

const COLUMNS = 9;

function row(b) {
  const cancelButton = b.status === "cancelled" ? "" : el("button", { onclick: () => cancel(b.id) }, "Cancel");
  return el("tr", {},
    el("td", { class: "mono" }, b.id),
    el("td", { class: "mono" }, b.customerId),
    el("td", {}, b.boothId),
    el("td", {}, b.backdropId),
    el("td", {}, b.eventDate),
    el("td", {}, b.package),
    el("td", { class: b.status === "cancelled" ? "muted" : "" }, b.status),
    el("td", {}, money(b.depositCents)),
    el("td", {}, cancelButton));
}

export async function loadBookings() {
  const body = $("bookings").tBodies[0];
  if (!session.token()) return body.replaceChildren(messageRow(COLUMNS, "Sign in to see bookings."));

  const result = await api.listBookings();
  if (!Array.isArray(result.body)) return body.replaceChildren(messageRow(COLUMNS, describe(result), ""));
  if (!result.body.length) return body.replaceChildren(messageRow(COLUMNS, "No bookings yet."));
  body.replaceChildren(...result.body.map(row));
}

async function cancel(id) {
  await api.cancelBooking(id);
  loadBookings();
}

export function initBookings() {
  $("refresh").onclick = loadBookings;
  session.onChange(loadBookings);
  loadBookings();
}
