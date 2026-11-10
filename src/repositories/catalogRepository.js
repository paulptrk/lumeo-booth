// booths and backdrops. db can be the pool or a client inside a transaction.

function toBooth(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    basePriceCents: row.base_price_cents,
    active: row.active,
  };
}

function toBackdrop(row) {
  return { id: row.id, name: row.name, active: row.active };
}

export class CatalogRepository {
  constructor(db) {
    this.db = db;
  }

  async findBooth(id) {
    const { rows } = await this.db.query(
      "SELECT id, name, type, base_price_cents, active FROM booths WHERE id = $1",
      [id]
    );
    return rows[0] ? toBooth(rows[0]) : null;
  }

  async listActiveBooths() {
    const { rows } = await this.db.query(
      "SELECT id, name, type, base_price_cents, active FROM booths WHERE active ORDER BY id"
    );
    return rows.map(toBooth);
  }

  async findBackdrop(id) {
    const { rows } = await this.db.query("SELECT id, name, active FROM backdrops WHERE id = $1", [id]);
    return rows[0] ? toBackdrop(rows[0]) : null;
  }

  async listActiveBackdrops() {
    const { rows } = await this.db.query("SELECT id, name, active FROM backdrops WHERE active ORDER BY id");
    return rows.map(toBackdrop);
  }
}
