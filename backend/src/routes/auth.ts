import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { pool } from "../lib/db";
import { signSession, readUserId } from "../lib/auth";

export const authRouter = Router();

const client = () =>
  new OAuth2Client(config.google.clientId, config.google.clientSecret, `${config.backendUrl}/auth/google/callback`);

authRouter.get("/google", (_req, res) => {
  const url = client().generateAuthUrl({ scope: ["openid", "email", "profile"], prompt: "select_account" });
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    const c = client();
    const { tokens } = await c.getToken(String(req.query.code));
    const ticket = await c.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload()!;
    const { rows } = await pool.query(
      `INSERT INTO users(google_id, email, name, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, avatar=EXCLUDED.avatar
       RETURNING id`,
      [p.sub, p.email, p.name, p.picture]
    );
    res.cookie("token", signSession(rows[0].id), { httpOnly: true, sameSite: "lax", maxAge: 7 * 864e5 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error("[auth]", e);
    res.redirect(`${config.frontendUrl}/?error=login_failed`);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const uid = readUserId(req);
  if (!uid) return res.status(401).json({ error: "Not signed in" });
  const { rows } = await pool.query("SELECT id, email, name, avatar FROM users WHERE id=$1", [uid]);
  if (!rows[0]) return res.status(401).json({ error: "Not signed in" });
  res.json(rows[0]);
});
