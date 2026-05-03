import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id serial PRIMARY KEY,
        parcel_id text NOT NULL,
        address text NOT NULL,
        owner_name text NOT NULL,
        mailing_address text,
        city text,
        state text,
        zip_code text,
        land_value text,
        total_value text,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS lot_number text;
      CREATE TABLE IF NOT EXISTS sync_log (
        id serial PRIMARY KEY,
        synced_at timestamp DEFAULT now() NOT NULL,
        count integer NOT NULL DEFAULT 0,
        success text NOT NULL DEFAULT 'true',
        message text
      );
    `);
    logger.info("Schema ensured");
  } finally {
    client.release();
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure schema, starting anyway");
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  });
