import express from "express";
import healthRouter from "./routes/health.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(healthRouter);
  // TODO: mount booths, bookings and auth routes here

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
