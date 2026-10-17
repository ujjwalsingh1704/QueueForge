import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { pool } from "../lib/db";
import { requireAuth, AuthedRequest, readUserId } from "../lib/auth";

export const slackRouter = Router();
const redirectUri = `${config.backendUrl}/api/slack/callback`;

// Slack redirects the browser here, so it uses the session cookie directly (no requireAuth JSON 401).
slackRouter.get("/callback", async (req, res) => {
  const uid = readUserId(req);
  try {
    const state = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: number };
    if (!uid || state.uid !== uid) throw new Error("state mismatch");
    const r = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    const data: any = await r.json();
    if (!data.ok || !data.incoming_webhook) throw new Error(data.error ?? "no webhook returned");
    await pool.query(
      `INSERT INTO slack_connections(user_id, webhook_url, channel) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url, channel=EXCLUDED.channel`,
      [uid, data.incoming_webhook.url, data.incoming_webhook.channel]
    );
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.error("[slack]", e);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

slackRouter.use(requireAuth);

slackRouter.get("/status", async (req, res) => {
  const { rows } = await pool.query("SELECT channel FROM slack_connections WHERE user_id=$1", [(req as AuthedRequest).userId]);
  res.json({ connected: !!rows[0], channel: rows[0]?.channel ?? null });
});

slackRouter.get("/connect", (req, res) => {
  const state = jwt.sign({ uid: (req as AuthedRequest).userId }, config.jwtSecret, { expiresIn: "10m" });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: "incoming-webhook",
    redirect_uri: redirectUri,
    state,
  }).toString();
  res.redirect(url.toString());
});

slackRouter.delete("/", async (req, res) => {
  await pool.query("DELETE FROM slack_connections WHERE user_id=$1", [(req as AuthedRequest).userId]);
  res.json({ connected: false, channel: null });
});
