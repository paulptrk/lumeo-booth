// small helpers for building the page. text always goes in as textContent,
// never as html, so data from the api can't inject markup.

import { describe } from "./format.js";

export const $ = (id) => document.getElementById(id);

// el("td", { class: "mono", onclick: fn }, "text", childNode)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === "class") node.className = value;
    else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child ?? "")));
  return node;
}

// a coloured badge for an http status: green 2xx, amber 4xx, red 5xx.
// status 0 means the request never got an answer (network error)
export function statusPill(status) {
  return el("span", { class: `pill ${status ? `s${String(status)[0]}` : "s5"}` }, status || "ERR");
}

// shows "<status> <description>" for an api result inside node
export function showResult(node, result) {
  node.replaceChildren(statusPill(result.status), " ", describe(result));
}

// a single full-width message row for a table body
export function messageRow(columns, text, className = "muted") {
  return el("tr", {}, el("td", { colspan: columns, class: className }, text));
}
