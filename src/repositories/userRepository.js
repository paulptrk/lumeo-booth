// users. db can be the pool or a client inside a transaction.

import { isId } from "./ids.js";

export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  // returns { id, role } or null. a non-numeric id returns null without touching the db
  async findById(id) {
    if (!isId(id)) return null;
    const { rows } = await this.db.query("SELECT id, role FROM users WHERE id = $1", [id]);
    return rows[0] ? { id: rows[0].id, role: rows[0].role } : null;
  }
}
