import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/pool.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seeds", "seed.sql");

pool
  .query(fs.readFileSync(file, "utf8"))
  .then(() => console.log("seed data inserted"))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
