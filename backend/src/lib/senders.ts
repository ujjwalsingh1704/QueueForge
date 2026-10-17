import nodemailer from "nodemailer";
import { pool } from "./db";
import { config } from "../config";

/** Creates Ethereal SMTP accounts on first boot so no manual setup is needed. */
export async function ensureSenders() {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM senders");
  for (let i = rows[0].n; i < config.senderCount; i++) {
    const acc = await nodemailer.createTestAccount();
    await pool.query(
      `INSERT INTO senders(email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [acc.user, acc.smtp.host, acc.smtp.port, acc.smtp.secure, acc.user, acc.pass]
    );
    console.log(`[senders] created Ethereal sender ${acc.user}`);
  }
}

export const listSenders = async () =>
  (await pool.query("SELECT * FROM senders ORDER BY id")).rows as { id: number }[];
