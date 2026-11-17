// the lumeo booth api, one function per endpoint (same endpoints as openapi.yaml).
// no dom code here. every call goes through request(), which adds the bearer token
// and Idempotency-Key and tells listeners about the call (the request log).
//
// each function resolves to { method, path, key, status, body, replayed, ms }.
// it never throws: a network failure comes back as status 0.

import * as session from "./session.js";

const listeners = [];

export function onRequest(fn) {
  listeners.push(fn);
}

// quiet: background calls (lists, health) that shouldn't fill the request log
async function request(method, path, { body, key, quiet = false } = {}) {
  const headers = {};
  if (session.token()) headers.Authorization = `Bearer ${session.token()}`;
  if (key) headers["Idempotency-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const started = performance.now();
  const result = { method, path, key, status: 0, body: null, replayed: false, ms: 0 };
  try {
    const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    result.status = res.status;
    result.replayed = res.headers.get("Idempotent-Replayed") === "true";
    result.body = parseJson(text);
  } catch (err) {
    result.body = { error: { code: "network", message: err.message } };
  }
  result.ms = Math.round(performance.now() - started);

  if (!quiet) for (const fn of listeners) fn(result);
  // the token expired or its user is gone: sign out instead of failing every call
  if (result.status === 401 && session.token() && !path.startsWith("/auth/")) session.clear();
  return result;
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const enc = encodeURIComponent;

export const health = () => request("GET", "/health", { quiet: true });

export const login = (email, password) => request("POST", "/auth/login", { body: { email, password } });
export const register = (email, password) => request("POST", "/auth/register", { body: { email, password } });

export const listBooths = () => request("GET", "/booths", { quiet: true });
export const listBackdrops = () => request("GET", "/backdrops", { quiet: true });
export const availability = (boothId, date) => request("GET", `/booths/${enc(boothId)}/availability?date=${enc(date)}`);

export const createBooking = (input, key) => request("POST", "/bookings", { body: input, key });
export const listBookings = () => request("GET", "/bookings", { quiet: true });
export const cancelBooking = (id) => request("PATCH", `/bookings/${enc(id)}/cancel`);
