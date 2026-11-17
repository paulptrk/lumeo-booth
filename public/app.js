// demo console for the lumeo booth api (loaded by index.html as a module).
// it only calls the public api (same endpoints as openapi.yaml), so every rule
// is still enforced by the server, never by this page.

// --- small helpers ---------------------------------------------------------

const $ = (id) => document.getElementById(id);

// builds an element. text always goes in as textContent, never as html,
// so data from the api can't inject markup
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c ?? "")));
  return node;
}

function statusPill(status) {
  return el("span", { class: `pill s${String(status)[0]}` }, status);
}

function newKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // randomUUID only exists on https or localhost
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomFarDate() {
  const r = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo));
  return `${r(2090, 2100)}-${String(r(1, 13)).padStart(2, "0")}-${String(r(1, 29)).padStart(2, "0")}`;
}

function dateInDays(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

// --- api calls ---------------------------------------------------------------

let token = store.get("lumeo-token");

// calls the api, logs the call, returns { status, body, replayed, ms }
async function api(method, path, { body, key, log = true } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers["Idempotency-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const started = performance.now();
  let res, data;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch (err) {
    const out = { status: 0, body: { error: { code: "network", message: err.message } }, replayed: false, ms: 0 };
    if (log) addLog(method, path, out);
    return out;
  }
  const out = {
    status: res.status,
    body: data,
    replayed: res.headers.get("Idempotent-Replayed") === "true",
    ms: Math.round(performance.now() - started),
  };
  if (log) addLog(method, path, out, key);
  if (res.status === 401 && token && !path.startsWith("/auth/")) setToken(null); // expired or deleted user
  return out;
}

function describe(r) {
  if (r.body?.error) return `${r.body.error.code}: ${r.body.error.message}`;
  if (r.body?.id) return `booking ${r.body.id} (${r.body.status})${r.replayed ? ", replayed" : ""}`;
  return "";
}

function addLog(method, path, r, key) {
  const summary = el("summary", {}, statusPill(r.status || "ERR"), el("code", {}, `${method} ${path}`),
    r.replayed ? el("span", { class: "pill muted" }, "Idempotent-Replayed") : "",
    el("span", { class: "muted" }, describe(r)), el("span", { class: "muted" }, `${r.ms} ms`));
  const detail = el("pre", {}, (key ? `Idempotency-Key: ${key}\n\n` : "") + JSON.stringify(r.body, null, 2));
  const log = $("log");
  log.prepend(el("details", {}, summary, detail));
  while (log.children.length > 60) log.lastChild.remove();
}

// --- sign in -----------------------------------------------------------------

// shows what the token claims. the server never trusts the role in it, it
// reloads the user's role from the database on every request
function tokenClaims(t) {
  try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
}

function setToken(t) {
  token = t;
  store.set("lumeo-token", t);
  const claims = t && tokenClaims(t);
  $("who").textContent = claims ? `user #${claims.sub} · ${claims.role}` : "signed out";
  if (t) loadBookings(); else $("bookings").tBodies[0].replaceChildren();
}

async function signIn(path) {
  const r = await api("POST", path, { body: { email: $("email").value, password: $("password").value } });
  const out = $("auth-result");
  if (r.body?.token) {
    setToken(r.body.token);
    out.replaceChildren(statusPill(r.status), " signed in");
  } else {
    out.replaceChildren(statusPill(r.status), " ", describe(r));
  }
}

$("login").onclick = () => signIn("/auth/login");
$("register").onclick = () => signIn("/auth/register");
$("logout").onclick = () => { setToken(null); $("auth-result").textContent = "signed out"; };
document.querySelectorAll("[data-dev]").forEach((b) => {
  // the seeded dev accounts (see seeds/seed.sql). local testing only
  b.onclick = () => { $("email").value = b.dataset.dev; $("password").value = "dev-password-123"; signIn("/auth/login"); };
});

// --- catalog + booking -------------------------------------------------------

async function loadCatalog() {
  const [booths, backdrops] = await Promise.all([api("GET", "/booths", { log: false }), api("GET", "/backdrops", { log: false })]);
  const fill = (select, items) => select.replaceChildren(...(Array.isArray(items) ? items : []).map((i) => el("option", { value: i.id }, i.name)));
  fill($("booth"), booths.body);
  fill($("backdrop"), backdrops.body);
}

function bookingInput(date) {
  return { boothId: $("booth").value, backdropId: $("backdrop").value, eventDate: date ?? $("date").value, package: $("package").value };
}

$("new-key").onclick = () => { $("key").value = newKey(); };

$("check").onclick = async () => {
  const r = await api("GET", `/booths/${encodeURIComponent($("booth").value)}/availability?date=${encodeURIComponent($("date").value)}`);
  const out = $("book-result");
  if (r.status === 200) out.replaceChildren(el("b", { class: r.body.available ? "s2" : "bad" }, r.body.available ? "Free" : "Taken"), ` on ${r.body.date}`);
  else out.replaceChildren(statusPill(r.status), " ", describe(r));
};

$("book").onclick = async () => {
  const r = await api("POST", "/bookings", { body: bookingInput(), key: $("key").value });
  $("book-result").replaceChildren(statusPill(r.status), " ", describe(r));
  loadBookings();
};

// --- race --------------------------------------------------------------------

$("race-date-new").onclick = () => { $("race-date").value = randomFarDate(); };

$("race").onclick = async () => {
  const button = $("race");
  button.disabled = true;
  const n = Math.max(2, Math.min(50, Number($("race-n").value) || 10));
  const date = $("race-date").value;
  const shared = newKey();
  const keys = Array.from({ length: n }, () => ($("race-mode").value === "same" ? shared : newKey()));

  // all requests are started before any is awaited
  const results = await Promise.all(keys.map((key) => api("POST", "/bookings", { body: bookingInput(date), key })));

  const table = $("race-table");
  table.hidden = false;
  table.tBodies[0].replaceChildren(...results.map((r, i) => el("tr", {}, el("td", {}, i + 1), el("td", {}, statusPill(r.status)), el("td", {}, describe(r)), el("td", {}, r.ms))));

  const count = (s) => results.filter((r) => r.status === s).length;
  const replays = results.filter((r) => r.replayed).length;
  const ids = new Set(results.filter((r) => r.body?.id).map((r) => r.body.id));
  $("race-summary").replaceChildren(
    el("b", {}, `${count(201)} × 201`), `, ${count(409)} × 409`, replays ? `, ${replays} replays` : "",
    `, ${ids.size} booking${ids.size === 1 ? "" : "s"} created for ${date}. `,
    el("span", { class: ids.size <= 1 ? "s2" : "bad" }, ids.size <= 1 ? "No double booking." : "Double booking!"));

  $("race-date").value = randomFarDate(); // next race gets a fresh date
  button.disabled = false;
  loadBookings();
};

// --- bookings ----------------------------------------------------------------

async function loadBookings() {
  const body = $("bookings").tBodies[0];
  if (!token) return body.replaceChildren(el("tr", {}, el("td", { colspan: 9, class: "muted" }, "Sign in to see bookings.")));
  const r = await api("GET", "/bookings", { log: false });
  if (!Array.isArray(r.body)) return body.replaceChildren(el("tr", {}, el("td", { colspan: 9 }, describe(r))));
  if (!r.body.length) return body.replaceChildren(el("tr", {}, el("td", { colspan: 9, class: "muted" }, "No bookings yet.")));
  body.replaceChildren(...r.body.map((b) => el("tr", {},
    el("td", { class: "mono" }, b.id), el("td", { class: "mono" }, b.customerId), el("td", {}, b.boothId), el("td", {}, b.backdropId),
    el("td", {}, b.eventDate), el("td", {}, b.package), el("td", { class: b.status === "cancelled" ? "muted" : "" }, b.status),
    el("td", {}, `$${(b.depositCents / 100).toFixed(2)}`),
    el("td", {}, b.status === "cancelled" ? "" : el("button", { onclick: () => cancel(b.id) }, "Cancel")))));
}

async function cancel(id) {
  await api("PATCH", `/bookings/${encodeURIComponent(id)}/cancel`);
  loadBookings();
}

$("refresh").onclick = loadBookings;

// --- start -------------------------------------------------------------------

async function checkHealth() {
  const r = await api("GET", "/health", { log: false });
  const pill = $("health");
  pill.className = `pill ${r.status === 200 ? "s2" : "s5"}`;
  pill.textContent = r.status === 200 ? "api + db up" : r.status === 0 ? "api down" : "db down";
}

$("date").value = dateInDays(30);
$("race-date").value = randomFarDate();
$("key").value = newKey();
setToken(token);
loadCatalog();
checkHealth();
setInterval(checkHealth, 15000);
