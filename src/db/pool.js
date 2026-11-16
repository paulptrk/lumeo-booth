import pg from "pg";

// return DATE columns as "YYYY-MM-DD" strings instead of JS Dates (avoids timezone shifts)
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// an idle connection can drop when postgres restarts. pg reports that as an
// "error" event, and with no listener node crashes the whole process.
// log just the message (never the client object) and let the pool reconnect
pool.on("error", (err) => {
  console.error(`database connection error: ${err.message}`);
});
