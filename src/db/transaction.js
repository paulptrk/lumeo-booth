import { pool } from "./pool.js";

// runs fn inside one transaction on one connection.
// commits if fn finishes, rolls back if it throws.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// runs fn inside a savepoint of a transaction that's already open on client.
// if fn throws, only fn's changes are undone and the transaction can keep going.
// needed because in postgres any failed statement (like a unique violation)
// otherwise aborts the whole transaction
export async function withSavepoint(client, fn) {
  await client.query("SAVEPOINT attempt");
  try {
    const result = await fn();
    await client.query("RELEASE SAVEPOINT attempt");
    return result;
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT attempt");
    throw err;
  }
}
