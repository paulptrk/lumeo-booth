import express, { Router } from "express";
import * as authService from "../services/authService.js";

const router = Router();

router.post("/register", express.json(), async (req, res) => {
  const { email, password } = req.body ?? {};
  res.status(201).json(await authService.register(email, password));
});

router.post("/login", express.json(), async (req, res) => {
  const { email, password } = req.body ?? {};
  res.json(await authService.login(email, password));
});

export default router;
