import express from "express";
import healthRouter from "./routes/health.js";
import boothsRouter from "./routes/booths.js";
import bookingsRouter from "./routes/bookings.js";
import { fakeAuth } from "./middleware/fakeAuth.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(healthRouter);
  app.use(boothsRouter);
  // TODO: mount auth routes here, and swap fakeAuth for the real jwt middleware
  app.use("/bookings", fakeAuth, bookingsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
