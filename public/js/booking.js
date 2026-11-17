// panel: the booking form (booth, backdrop, date, package, Idempotency-Key),
// "check availability" and "book". the race panel reuses bookingInput.

import * as api from "./api.js";
import { $, el, showResult } from "./dom.js";
import { dateInDays, newKey } from "./values.js";

// the request body from the form. date overrides the form's date (the race uses its own)
export function bookingInput(date = $("date").value) {
  return { boothId: $("booth").value, backdropId: $("backdrop").value, eventDate: date, package: $("package").value };
}

function fillSelect(select, items) {
  const list = Array.isArray(items) ? items : [];
  select.replaceChildren(...list.map((item) => el("option", { value: item.id }, item.name)));
}

async function loadCatalog() {
  const [booths, backdrops] = await Promise.all([api.listBooths(), api.listBackdrops()]);
  fillSelect($("booth"), booths.body);
  fillSelect($("backdrop"), backdrops.body);
}

async function checkAvailability() {
  const result = await api.availability($("booth").value, $("date").value);
  if (result.status !== 200) return showResult($("book-result"), result);
  const { available, date } = result.body;
  $("book-result").replaceChildren(el("b", { class: available ? "s2" : "bad" }, available ? "Free" : "Taken"), ` on ${date}`);
}

// the key stays the same until "New key" is clicked, so clicking Book twice is a retry
async function book(onBooked) {
  const result = await api.createBooking(bookingInput(), $("key").value);
  showResult($("book-result"), result);
  onBooked();
}

export function initBooking({ onBooked }) {
  $("date").value = dateInDays(30);
  $("key").value = newKey();
  $("new-key").onclick = () => {
    $("key").value = newKey();
  };
  $("check").onclick = checkAvailability;
  $("book").onclick = () => book(onBooked);
  loadCatalog();
}
