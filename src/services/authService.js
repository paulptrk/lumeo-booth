import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loadConfig } from "../config.js";
import { pool } from "../db/pool.js";
import { checkPassword, normalizeEmail } from "../domain/credentials.js";
import { InvalidPassword, Unauthenticated } from "../domain/errors.js";
import { isId } from "../domain/ids.js";
import { UserRepository } from "../repositories/userRepository.js";

const BCRYPT_COST = 10;
const TOKEN_LIFETIME = "1h";

function issueToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, loadConfig().jwtSecret, {
    algorithm: "HS256",
    expiresIn: TOKEN_LIFETIME,
  });
}

// creates a customer account and returns a token for it. the role is never taken from
// the request, the database gives every new user the customer role.
export async function register(rawEmail, rawPassword) {
  const email = normalizeEmail(rawEmail);
  checkPassword(rawPassword);
  const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_COST);
  const user = await new UserRepository(pool).create(email, passwordHash);
  return { token: issueToken(user) };
}

// a wrong email and a wrong password give the same error, so the api doesn't reveal which emails exist
export async function login(rawEmail, rawPassword) {
  const email = normalizeEmail(rawEmail);
  if (typeof rawPassword !== "string") throw new InvalidPassword();
  const user = await new UserRepository(pool).findByEmail(email);
  if (!user || !(await bcrypt.compare(rawPassword, user.passwordHash))) {
    throw new Unauthenticated("Invalid email or password");
  }
  return { token: issueToken(user) };
}

// checks the "Authorization: Bearer <token>" header and returns the caller as { id, role }.
// only the token's subject is used, the role is reloaded from the users table so a deleted
// user or a changed role takes effect right away. every token problem gives the same message.
export async function authenticate(authorizationHeader) {
  const match = /^Bearer (.+)$/.exec(authorizationHeader ?? "");
  if (!match) throw new Unauthenticated();
  let payload;
  try {
    payload = jwt.verify(match[1], loadConfig().jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new Unauthenticated("Invalid or expired token");
  }
  const user = isId(payload.sub) ? await new UserRepository(pool).findById(payload.sub) : null;
  if (!user) throw new Unauthenticated("Invalid or expired token");
  return user;
}
