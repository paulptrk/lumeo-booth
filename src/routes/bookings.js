import { Router } from "express";
import * as bookingService from "../services/bookingService.js";

const router = Router();

// http in, service call, http out. no rules here
router.post("/", async (req, res) => {
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
