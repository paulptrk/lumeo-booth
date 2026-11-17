import path from "node:path";
import express, { Router } from "express";

// the demo front end (public/index.html) at "/". it's a client of the api like
// any other, so it isn't described in openapi.yaml
const router = Router();

router.use(express.static(path.join(import.meta.dirname, "..", "..", "public")));

export default router;
