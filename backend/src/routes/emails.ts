import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { scheduleBatch } from "../lib/scheduler";
import { searchEmails } from "../lib/es";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(100_000),
  startTime: z.string().datetime({ offset: true }),
  delaySeconds: z.number().min(0).default(0),
  hourlyLimit: z.number().int().positive().optional(),
});

emailsRouter.post("/schedule", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const recipients = [...new Set(d.recipients.map((r) => r.trim().toLowerCase()))];
  const count = await scheduleBatch({
    userId: (req as AuthedRequest).userId,
    subject: d.subject,
    body: d.body,
    recipients,
    startTime: new Date(d.startTime),
    delayMs: d.delaySeconds * 1000,
    hourlyLimit: d.hourlyLimit,
  });
  res.status(201).json({ scheduled: count });
});

// GET /api/emails?status=scheduled|sent
emailsRouter.get("/", async (req, res) => {
  const uid = (req as AuthedRequest).userId;
  const statuses = req.query.status === "sent" ? ["sent", "failed"] : ["scheduled", "processing"];
  const order = req.query.status === "sent" ? "sent_at DESC NULLS LAST, id DESC" : "scheduled_at ASC, id ASC";
  const { rows } = await pool.query(
    `SELECT id, to_email, subject, scheduled_at, sent_at, status, error, preview_url,
            left(regexp_replace(body, '<[^>]+>', ' ', 'g'), 140) AS preview
       FROM emails WHERE user_id=$1 AND status = ANY($2) ORDER BY ${order} LIMIT 500`,
    [uid, statuses]
  );
  res.json(rows);
});

// GET /api/emails/search?q=...   (Elasticsearch)
emailsRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  try {
    res.json(await searchEmails((req as AuthedRequest).userId, q));
  } catch {
    res.status(503).json({ error: "Search is unavailable" });
  }
});

// GET /api/emails/counts  -> sidebar badges
emailsRouter.get("/counts", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status IN ('scheduled','processing'))::int AS scheduled,
       count(*) FILTER (WHERE status IN ('sent','failed'))::int AS sent
     FROM emails WHERE user_id=$1`,
    [(req as unknown as AuthedRequest).userId]
  );
  res.json(rows[0]);
});

// GET /api/emails/:id  -> detail view (must stay after /search and /counts)
emailsRouter.get("/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const { rows } = await pool.query(
    `SELECT e.id, e.to_email, e.subject, e.body, e.scheduled_at, e.sent_at, e.status, e.error, e.preview_url,
            s.email AS sender_email
       FROM emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1 AND e.user_id=$2`,
    [req.params.id, (req as unknown as AuthedRequest).userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Email not found" });
  res.json(rows[0]);
});
