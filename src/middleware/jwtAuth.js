// checks the bearer token and sets req.user = { id, role }.
// express 5 passes a rejected promise to the error handler, so no try/catch

import { authenticate } from "../services/authService.js";

export async function jwtAuth(req, res, next) {
  req.user = await authenticate(req.get("Authorization"));
  next();
}
