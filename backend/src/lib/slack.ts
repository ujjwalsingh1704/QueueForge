import { pool } from "./db";

/** Posts to the user's Slack webhook. No connection => silently skipped. */
export async function notifyRateLimit(userId: number, senderEmail: string, limit: number, resumeAt: Date) {
  const { rows } = await pool.query("SELECT webhook_url FROM slack_connections WHERE user_id=$1", [userId]);
  if (!rows[0]) return false;
  try {
    const res = await fetch(rows[0].webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:warning: Hourly limit reached for *${senderEmail}* (${limit}/hour). Remaining emails are rescheduled and will resume at ${resumeAt.toISOString()}.`,
      }),
    });
    if (!res.ok) console.warn("[slack] webhook responded", res.status);
    return res.ok;
  } catch (e) {
    console.warn("[slack] notify failed:", (e as Error).message);
    return false;
  }
}
