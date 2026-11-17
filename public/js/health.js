// header badge: is the api up, and can it reach the database?

import * as api from "./api.js";
import { $ } from "./dom.js";

const EVERY_MS = 15_000;

async function check() {
  const { status } = await api.health();
  const pill = $("health");
  pill.className = `pill ${status === 200 ? "s2" : "s5"}`;
  pill.textContent = status === 200 ? "api + db up" : status === 0 ? "api down" : "db down";
}

export function initHealth() {
  check();
  setInterval(check, EVERY_MS);
}
