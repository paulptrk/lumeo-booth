import express, { Router } from "express";
import * as bookingService from "../services/bookingService.js";
import { fakeAuth } from "../middleware/fakeAuth.js";

const router = Router();

// every booking route needs a logged-in user.
// TODO: swap fakeAuth for the real jwt middleware (it only has to set req.user = { id, role })
router.use(fakeAuth);

// http in, service call, http out. no rules here.
// only this route has a body, so it is parsed here, after auth: an unauthenticated
// caller gets 401 before any of its body is read
router.post("/", express.json(), async (req, res) => {
  const key = req.get("Idempotency-Key");
  const { booking, replayed } = await bookingService.createBooking(req.user, req.body ?? {}, key, new Date());
  if (replayed) res.set("Idempotent-Replayed", "true");
  res.status(replayed ? 200 : 201).json(booking);
});

router.get("/", async (req, res) => {
  res.json(await bookingService.listBookings(req.user));
});

router.get("/:id", async (req, res) => {
  res.json(await bookingService.getBooking(req.user, req.params.id));
});

router.patch("/:id/cancel", async (req, res) => {
  res.json(await bookingService.cancelBooking(req.user, req.params.id, new Date()));
});

export default router;
