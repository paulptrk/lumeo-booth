// TEMPORARY until real login/JWT is done. reads the user from headers so the
// booking routes can be tested. the real auth middleware just needs to set
// req.user = { id, role } the same way and this file can be deleted.
//
//   X-User-Id: 1
//   X-User-Role: customer | staff

export function fakeAuth(req, res, next) {
  const id = req.get("X-User-Id");
  if (!id) {
    return res.status(401).json({ error: { code: "unauthenticated", message: "Missing X-User-Id header" } });
  }
  req.user = { id, role: req.get("X-User-Role") === "staff" ? "staff" : "customer" };
  next();
}
