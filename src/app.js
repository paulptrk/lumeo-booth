import express from "express";
import healthRouter from "./routes/health.js";
import boothsRouter from "./routes/booths.js";
import bookingsRouter from "./routes/bookings.js";
import authRouter from "./routes/auth.js";
import docsRouter from "./routes/docs.js";
import uiRouter from "./routes/ui.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

// the api's routers and where they're mounted. test/contract checks every route
// in them against openapi.yaml, and fails if the app mounts a router that isn't
// listed here, so mount new routers through this list.
export const apiRouters = [
  { prefix: "/", router: healthRouter },
  { prefix: "/", router: boothsRouter },
  { prefix: "/bookings", router: bookingsRouter },
  { prefix: "/auth", router: authRouter },
];

export function createApp() {
  const app = express();

  // the spec itself and the demo front end, so neither is described in the spec
  app.use(docsRouter);
  app.use(uiRouter);
  for (const { prefix, router } of apiRouters) app.use(prefix, router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
