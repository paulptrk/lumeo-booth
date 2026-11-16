// turns "who the caller says they are" into a trusted actor { id, role }.
// the role always comes from the users table, never from the request.
// the real jwt middleware will call this with the token's subject instead of a header.

import { pool } from "../db/pool.js";
import { Unauthenticated } from "../domain/errors.js";
import { isId } from "../domain/ids.js";
import { UserRepository } from "../repositories/userRepository.js";

export async function resolveActor(rawId) {
  if (!rawId) throw new Unauthenticated("Missing X-User-Id header");
  if (!isId(rawId)) throw new Unauthenticated("X-User-Id must be a user id");
  const user = await new UserRepository(pool).findById(rawId);
  if (!user) throw new Unauthenticated("Unknown user");
  return user;
}
