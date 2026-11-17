import { EmailTaken } from "../domain/errors.js";

const UNIQUE_VIOLATION = "23505";

// users. db can be the pool or a client inside a transaction.
// the id must already be valid (see domain/ids.js), the service checks it.

export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  // returns { id, role } or null
  async findById(id) {
    const { rows } = await this.db.query("SELECT id, role FROM users WHERE id = $1", [id]);
    return rows[0] ? { id: rows[0].id, role: rows[0].role } : null;
  }

  // returns { id, role, passwordHash } or null. only login needs the hash.
  async findByEmail(email) {
    const { rows } = await this.db.query(
      "SELECT id, role, password_hash FROM users WHERE email = $1",
      [email]
    );
    return rows[0] ? { id: rows[0].id, role: rows[0].role, passwordHash: rows[0].password_hash } : null;
  }

  // the role is left to the column default (customer), so staff can't be made from here.
  // the email is the only unique column that can clash, so any unique violation means it is taken.
  // returns { id, role }
  async create(email, passwordHash) {
    try {
      const { rows } = await this.db.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, role",
        [email, passwordHash]
      );
      return { id: rows[0].id, role: rows[0].role };
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) throw new EmailTaken();
      throw err;
    }
  }
}
