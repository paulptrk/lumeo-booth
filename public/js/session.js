// the signed-in user's token, kept for this browser tab. no dom code here.
// other modules call onChange to react when someone signs in or out.

const STORAGE_KEY = "lumeo-token";
const listeners = [];
let current = read();

function read() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode)
  }
}

function write(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the token still works until the page is closed
  }
}

export function token() {
  return current;
}

export function set(token) {
  current = token;
  write(token);
  for (const fn of listeners) fn(token);
}

export function clear() {
  set(null);
}

export function onChange(fn) {
  listeners.push(fn);
}

// what the token claims ({ sub, role, exp }), for display only. the server never
// trusts the role in it, it reloads the user's role from the database every request
export function claims() {
  if (!current) return null;
  try {
    return JSON.parse(atob(current.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}
