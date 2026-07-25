import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")
    ? { rejectUnauthorized: false }
    : undefined,
});

let initialized = false;

export async function initDb() {
  if (initialized) return;

  if (!connectionString) {
    console.warn("DATABASE_URL is not configured. Database operations will fail.");
    return;
  }

  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        quota_used INTEGER DEFAULT 0,
        quota_limit INTEGER DEFAULT 20
      );
    `);

    // Create payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(255) PRIMARY KEY,
        payer_name VARCHAR(255),
        amount NUMERIC,
        response_count INTEGER,
        form_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        redeemed BOOLEAN DEFAULT FALSE
      );
    `);

    initialized = true;
    console.log("PostgreSQL database tables initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    throw error;
  }
}
