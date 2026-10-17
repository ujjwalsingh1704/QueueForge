# Outbox – email scheduler service + dashboard

Express + TypeScript API, BullMQ/Redis delayed jobs, Postgres, Elasticsearch search, Ethereal SMTP, Slack alerts, and a React + Tailwind dashboard.

## Run it

```bash
docker compose up -d                     # Redis (AOF on), Postgres, Elasticsearch

cd backend
Copy-Item .env.example .env              # then fill in Google + Slack credentials
npm install
npm run dev:api                          # terminal 1  -> http://localhost:4000
npm run dev:worker                       # terminal 2  (BullMQ worker)

cd ../frontend
npm install
npm run dev                              # terminal 3  -> http://localhost:5173
```

- **Ethereal:** nothing to configure. On first boot the API creates `SENDER_COUNT` Ethereal accounts via `nodemailer.createTestAccount()` and stores them in the `senders` table. Each sent email gets a preview link in the dashboard.
- **Google OAuth:** create a Web OAuth client; redirect URI `http://localhost:4000/auth/google/callback`.
- **Slack OAuth:** create a Slack app, add scope `incoming-webhook`, redirect URL `http://localhost:4000/api/slack/callback`. (Slack requires HTTPS redirect URLs for non-localhost; use ngrok if needed.)
- **Database port:** Compose exposes Postgres on host port `5433`; the default `DATABASE_URL` and `.env.example` use that port. Change it if you map Postgres elsewhere.
- **Runtime settings:** `.env.example` documents concurrency, global minimum send spacing, per-sender hourly limit and Ethereal sender count. Use a long random `JWT_SECRET` outside local development.
- **Live queue dashboard:** http://localhost:4000/admin/queues (Bull Board).

## Architecture

**Scheduling.** `POST /api/emails/schedule` inserts one `emails` row per recipient in a single transaction (Postgres is the source of truth), then adds BullMQ jobs with `delay = scheduled_at - now`. Email *i* of a batch is scheduled at `start + i × delay`. Senders are assigned round-robin. No cron anywhere.

**Persistence / restarts.** Delayed jobs live in Redis (AOF enabled), not in process memory, so stopping the API/worker loses nothing; a restarted worker picks jobs up at their due time. On API boot, `reconcile()` re-enqueues any `scheduled` DB row missing from the queue (Redis wiped, or crash between COMMIT and `queue.add`). Job id is `email-<rowId>`, so re-adding is a no-op.

**Idempotency.** (1) Deterministic jobId. (2) Before sending, the worker atomically runs `UPDATE … SET status='processing' WHERE id=$1 AND status='scheduled'`; only the worker that wins the row sends. Jobs have `attempts: 1`.

**Concurrency.** `WORKER_CONCURRENCY` (default 5). Safe because all shared state is either an atomic Redis Lua script or an atomic SQL claim.

**Delay between sends.** BullMQ limiter `{ max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }`; default **2000 ms** between sends (global across workers on the queue). The per-batch "delay between emails" in the compose form additionally spaces the scheduled times.

**Hourly rate limit.** Per sender, key `rl:sender:<id>:<hourWindow>`, incremented by a Lua script that only increments if below the limit (atomic across workers and instances). Limit = the compose form's "Hourly limit" or `MAX_EMAILS_PER_HOUR_PER_SENDER` (default **200**). When exceeded, the job is **moved to delayed** at the next hour boundary (+ a small id-based offset to keep rough FIFO order) via `job.moveToDelayed` + `DelayedError`. Jobs are never failed or dropped.

**Slack.** "Connect Slack" runs the real OAuth v2 flow and stores the incoming-webhook URL per user. The first time a sender hits its limit in a window, a message is posted to that webhook (deduplicated with a `SET NX` key per sender/window). Not connected → skipped silently; connect later → works immediately, no redeploy.

**Search.** Rows are indexed into Elasticsearch on create and on status change (`GET /api/emails/search?q=`). Indexing is best effort and never blocks sending.

**1000+ emails at once.** All are queued as delayed jobs; the limiter paces sends, each sender sends at most its hourly limit, and overflow rolls into following hours automatically.

## Features

| Backend | Frontend |
|---|---|
| Schedule API, Postgres persistence | Google login page, sidebar with name/email/avatar + logout |
| BullMQ delayed jobs, no cron | Scheduled / Sent mailbox lists (with counts), email detail view, loading + empty states |
| Restart-safe + reconcile | Compose page: rich-text body, recipient chips, CSV/text lead upload (count shown), Send / Send later, delay, hourly limit |
| Idempotent sending | Slack connect/disconnect |
| Configurable concurrency, min delay, hourly limits (Redis) | Search, toasts, reusable components, typed API |
| Multiple Ethereal senders | |
| Slack OAuth + live notification | |
| Elasticsearch search, Bull Board | |

## Assumptions and trade-offs

- Delivery is **at-most-once**: if a worker crashes mid-send, that row stays `processing` and is not auto-retried (avoids duplicates). A production system would add a lease timeout.
- The min-delay limiter is queue-global, not per sender.
- UI follows the Figma screenshots (login, mailbox, detail, compose, send-later popover) but was built from a low-resolution export, so colors, fonts and spacing are close, not exact. Attachments and email/password login from the Figma are not implemented (not in the requirements).
- Rate-limit order is "rough FIFO" within the next window.
