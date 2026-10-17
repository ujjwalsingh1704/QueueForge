import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INT NOT NULL,
      smtp_secure BOOLEAN NOT NULL DEFAULT false,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emails (
      id BIGSERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      sender_id INT NOT NULL REFERENCES senders(id),
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      hourly_limit INT,
      status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | processing | sent | failed
      sent_at TIMESTAMPTZ,
      error TEXT,
      preview_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS emails_user_status_idx ON emails(user_id, status);
    CREATE TABLE IF NOT EXISTS slack_connections (
      user_id INT PRIMARY KEY REFERENCES users(id),
      webhook_url TEXT NOT NULL,
      channel TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export interface EmailRow {
  id: string;
  user_id: number;
  sender_id: number;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  hourly_limit: number | null;
  status: "scheduled" | "processing" | "sent" | "failed";
  sent_at: Date | null;
  error: string | null;
  preview_url: string | null;
}
