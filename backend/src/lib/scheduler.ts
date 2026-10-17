import { pool, EmailRow } from "./db";
import { emailQueue, jobIdFor } from "./queue";
import { listSenders } from "./senders";
import { indexEmail } from "./es";

export interface ScheduleInput {
  userId: number;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;       // spacing between consecutive emails of this batch
  hourlyLimit?: number;  // per-sender limit override
}

/**
 * 1. Insert all rows in one transaction (source of truth).
 * 2. Add delayed BullMQ jobs with deterministic ids.
 * Senders are assigned round-robin. Email i is scheduled at start + i * delay.
 */
export async function scheduleBatch(input: ScheduleInput) {
  const senders = await listSenders();
  if (!senders.length) throw new Error("No senders configured");

  const client = await pool.connect();
  const rows: EmailRow[] = [];
  try {
    await client.query("BEGIN");
    for (let i = 0; i < input.recipients.length; i++) {
      const at = new Date(input.startTime.getTime() + i * input.delayMs);
      const sender = senders[i % senders.length];
      const { rows: r } = await client.query(
        `INSERT INTO emails(user_id, sender_id, to_email, subject, body, scheduled_at, hourly_limit)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [input.userId, sender.id, input.recipients[i], input.subject, input.body, at, input.hourlyLimit ?? null]
      );
      rows.push(r[0]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await enqueueRows(rows);
  rows.forEach((r) => void indexEmail(r));
  return rows.length;
}

async function enqueueRows(rows: EmailRow[]) {
  const now = Date.now();
  await emailQueue.addBulk(
    rows.map((r) => ({
      name: "send",
      data: { emailId: String(r.id) },
      opts: { jobId: jobIdFor(r.id), delay: Math.max(0, new Date(r.scheduled_at).getTime() - now) },
    }))
  );
}

/**
 * Run on API boot: any DB row still 'scheduled' without a BullMQ job (Redis wiped, or the API
 * crashed between COMMIT and queue.add) is re-enqueued. Same jobId => no duplicates.
 */
export async function reconcile() {
  const { rows } = await pool.query("SELECT * FROM emails WHERE status='scheduled' ORDER BY id");
  let restored = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const existing = await Promise.all(chunk.map((r) => emailQueue.getJob(jobIdFor(r.id))));
    const missing = chunk.filter((_, idx) => !existing[idx]);
    if (missing.length) {
      await enqueueRows(missing);
      restored += missing.length;
    }
  }
  if (restored) console.log(`[reconcile] re-enqueued ${restored} missing jobs`);
}
