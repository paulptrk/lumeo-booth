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
}
