import { Router } from "express";
import * as bookingService from "../services/bookingService.js";

const router = Router();

// public, no login needed to browse

router.get("/booths", async (req, res) => {
  res.json(await bookingService.listBooths());
});

router.get("/backdrops", async (req, res) => {
  res.json(await bookingService.listBackdrops());
});

// GET /booths/booth_dslr_01/availability?date=2027-06-12
router.get("/booths/:id/availability", async (req, res) => {
  res.json(await bookingService.getBoothAvailability(req.params.id, req.query.date));
});

export default router;
