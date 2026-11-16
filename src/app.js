import express from "express";
import healthRouter from "./routes/health.js";
import boothsRouter from "./routes/booths.js";
import bookingsRouter from "./routes/bookings.js";
import docsRouter from "./routes/docs.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

// the api's routers and where they're mounted. test/contract checks every route
// in them against openapi.yaml, and fails if the app mounts a router that isn't
// listed here, so mount new routers through this list.
// TODO: add the auth routes here when login is done
export const apiRouters = [
  { prefix: "/", router: healthRouter },
  { prefix: "/", router: boothsRouter },
  { prefix: "/bookings", router: bookingsRouter },
];

export function createApp() {
  const app = express();

  // serves the spec itself, so it isn't described in it
  app.use(docsRouter);
  for (const { prefix, router } of apiRouters) app.use(prefix, router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
