// panel: sign in, register, sign out, and the "who am i" text in the header.

import * as api from "./api.js";
import * as session from "./session.js";
import { $, statusPill, showResult } from "./dom.js";

// the seeded dev accounts share this password (see seeds/seed.sql). it's for
// local testing only and is not a secret
const DEV_PASSWORD = "dev-password-123";

async function signIn(call) {
  const result = await call($("email").value, $("password").value);
  if (result.body?.token) {
    session.set(result.body.token);
    $("auth-result").replaceChildren(statusPill(result.status), " signed in");
  } else {
    showResult($("auth-result"), result);
  }
}

function showWho() {
  const claims = session.claims();
  $("who").textContent = claims ? `user #${claims.sub} · ${claims.role}` : "signed out";
}

export function initAuth() {
  $("login").onclick = () => signIn(api.login);
  $("register").onclick = () => signIn(api.register);
  $("logout").onclick = () => {
    session.clear();
    $("auth-result").textContent = "signed out";
  };
  for (const button of document.querySelectorAll("[data-dev]")) {
    button.onclick = () => {
      $("email").value = button.dataset.dev;
      $("password").value = DEV_PASSWORD;
      signIn(api.login);
    };
  }

  session.onChange(showWho);
  showWho();
}
