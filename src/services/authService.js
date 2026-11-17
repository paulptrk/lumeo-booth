// turns "who the caller says they are" into a trusted actor { id, role }.
// the role always comes from the users table, never from the request.
// the real jwt middleware will call this with the token's subject instead of a header.

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loadConfig } from "../config.js";
import { pool } from "../db/pool.js";
import { checkPassword, normalizeEmail } from "../domain/credentials.js";
import { Unauthenticated } from "../domain/errors.js";
import { isId } from "../domain/ids.js";
import { UserRepository } from "../repositories/userRepository.js";

const BCRYPT_COST = 10;
const TOKEN_LIFETIME = "1h";

// creates a customer account and returns a token for it. the role is never taken from
// the request, the database gives every new user the customer role.
export async function register(rawEmail, rawPassword) {
  const email = normalizeEmail(rawEmail);
  checkPassword(rawPassword);
  const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_COST);
  const user = await new UserRepository(pool).create(email, passwordHash);
  const token = jwt.sign({ sub: String(user.id), role: user.role }, loadConfig().jwtSecret, {
    algorithm: "HS256",
    expiresIn: TOKEN_LIFETIME,
  });
  return { token };
}

export async function resolveActor(rawId) {
  if (!rawId) throw new Unauthenticated("Missing X-User-Id header");
  if (!isId(rawId)) throw new Unauthenticated("X-User-Id must be a user id");
  const user = await new UserRepository(pool).findById(rawId);
  if (!user) throw new Unauthenticated("Unknown user");
  return user;
}
