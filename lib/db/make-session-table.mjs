import pg from "pg";
const url = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });
const sql = `
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;
const r = await pool.query(sql);
console.log("Session table ready.");
await pool.end();
