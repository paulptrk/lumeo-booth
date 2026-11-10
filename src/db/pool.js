import pg from "pg";

// return DATE columns as "YYYY-MM-DD" strings instead of JS Dates (avoids timezone shifts)
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
