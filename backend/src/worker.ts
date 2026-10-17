import { Worker, DelayedError, Job } from "bullmq";
import nodemailer from "nodemailer";
import { config } from "./config";
import { pool, migrate, EmailRow } from "./lib/db";
import { redis } from "./lib/redis";
import { QUEUE_NAME, EmailJobData } from "./lib/queue";
import { consumeSlot, refundSlot, windowStart, nextWindowStart, markLimitNotified } from "./lib/rateLimiter";
import { notifyRateLimit } from "./lib/slack";
import { indexEmail, ensureIndex } from "./lib/es";

async function hasSlackConnection(userId: number) {
  const { rows } = await pool.query("SELECT 1 FROM slack_connections WHERE user_id=$1", [userId]);
  return rows.length > 0;
}

async function processEmail(job: Job<EmailJobData>, token?: string) {
  const { rows } = await pool.query(
    `SELECT e.*, s.email AS sender_email, s.smtp_host, s.smtp_port, s.smtp_secure, s.smtp_user, s.smtp_pass
       FROM emails e JOIN senders s ON s.id = e.sender_id WHERE e.id = $1`,
    [job.data.emailId]
  );
  const email = rows[0];
  if (!email || email.status !== "scheduled") return; // already handled => idempotent

  // --- hourly rate limit (Redis, atomic, shared by all workers) ---
  const limit: number = email.hourly_limit ?? config.maxPerHour;
  const rateWindow = windowStart();
  if (!(await consumeSlot(email.sender_id, limit, rateWindow))) {
    const resumeAt = nextWindowStart(rateWindow);
    if (await hasSlackConnection(email.user_id) && await markLimitNotified(email.sender_id, email.user_id, rateWindow)) {
      void notifyRateLimit(email.user_id, email.sender_email, limit, new Date(resumeAt));
    }
    // Push into next hour; small id-based offset keeps rough FIFO order. Job is NOT failed or dropped.
    const offset = Number(BigInt(email.id) % 10000n);
    await job.moveToDelayed(resumeAt + offset, token);
    throw new DelayedError();
  }

  // --- idempotency: atomically claim the row, only one worker can win ---
  const claim = await pool.query(
    "UPDATE emails SET status='processing' WHERE id=$1 AND status='scheduled' RETURNING id",
    [email.id]
  );
  if (!claim.rowCount) {
    await refundSlot(email.sender_id, rateWindow);
    return;
  }

  try {
    const transport = nodemailer.createTransport({
      host: email.smtp_host,
      port: email.smtp_port,
      secure: email.smtp_secure,
      auth: { user: email.smtp_user, pass: email.smtp_pass },
    });
    const info = await transport.sendMail({
      from: `"Outbox" <${email.sender_email}>`,
      to: email.to_email,
      subject: email.subject,
      html: email.body,
    });
    const upd = await pool.query(
      "UPDATE emails SET status='sent', sent_at=now(), preview_url=$2 WHERE id=$1 RETURNING *",
      [email.id, nodemailer.getTestMessageUrl(info) || null]
    );
    void indexEmail(upd.rows[0] as EmailRow);
  } catch (err) {
    const upd = await pool.query("UPDATE emails SET status='failed', error=$2 WHERE id=$1 RETURNING *", [
      email.id,
      (err as Error).message,
    ]);
    void indexEmail(upd.rows[0] as EmailRow);
  }
}

async function main() {
  await migrate();
  await ensureIndex();

  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmail, {
    connection: redis,
    concurrency: config.workerConcurrency,
    // Global throttle: at most 1 send per MIN_DELAY_BETWEEN_EMAILS_MS across all workers on this queue.
    limiter: { max: 1, duration: config.minDelayMs },
  });

  worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));
  worker.on("ready", () =>
    console.log(`[worker] up. concurrency=${config.workerConcurrency} minDelay=${config.minDelayMs}ms limit/h=${config.maxPerHour}`)
  );

  const shutdown = async () => {
    await worker.close(); // in-flight jobs finish; everything else stays persisted in Redis
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
