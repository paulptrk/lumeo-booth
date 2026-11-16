// TEMPORARY until real login/JWT is done. reads the user id from a header and
// loads the user from the db, so the role always comes from users.role and a
// client can't claim to be staff. the real auth middleware just needs to set
// req.user = { id, role } the same way and this file can be deleted.
//
//   X-User-Id: 1
//
// express 5 passes a rejected promise to the error handler, so no try/catch

import { resolveActor } from "../services/authService.js";

export async function fakeAuth(req, res, next) {
  req.user = await resolveActor(req.get("X-User-Id"));
  next();
}
