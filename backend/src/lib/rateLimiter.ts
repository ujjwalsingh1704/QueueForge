import { redis } from "./redis";

const HOUR = 3600_000;

export const windowStart = (now = Date.now()) => Math.floor(now / HOUR) * HOUR;
export const nextWindowStart = (now = Date.now()) => windowStart(now) + HOUR;

const key = (senderId: number, ws: number) => `rl:sender:${senderId}:${ws}`;

/** Try to take one slot in the current hour window for this sender. */
export async function consumeSlot(senderId: number, limit: number, ws = windowStart()) {
  const ok = await redis.consumeSlot(key(senderId, ws), limit, 2 * HOUR);
  return ok === 1;
}

/** Give a slot back (used if the email turned out to be a duplicate). */
export async function refundSlot(senderId: number, ws = windowStart()) {
  await redis.decr(key(senderId, ws));
}

/** True only for the first caller in a window, so Slack is pinged once per sender/hour. */
export async function markLimitNotified(senderId: number, userId: number, ws = windowStart()) {
  const r = await redis.set(`rl:notified:${senderId}:${userId}:${ws}`, "1", "PX", 2 * HOUR, "NX");
  return r === "OK";
}
