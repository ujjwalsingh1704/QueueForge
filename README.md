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

## Deploy it

The root `Dockerfile` builds the dashboard and API together. The production Compose file runs the web service, a separate BullMQ worker, Postgres, Redis, Elasticsearch, and Caddy for HTTPS. **Oracle Cloud Always Free** can run the stack on one ARM64 Ubuntu VM: its free allocation includes up to 2 OCPUs, 12 GB RAM, 200 GB combined boot/block storage, and 10 TB monthly outbound transfer in the tenancy's home region. Oracle requires account verification (usually including a card), but says it does not charge for Always Free resources unless you upgrade; free VM capacity may not be available immediately. Use only resources labeled Always Free. See [Oracle's current Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) and [Free Tier account terms](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

1. Create or sign in to an Oracle Cloud Free Tier account. Select the home region closest to you. Create one `VM.Standard.A1.Flex` instance using **2 OCPUs and 12 GB RAM**, an **Ubuntu 24.04 ARM64** image, the default 50 GB boot volume, and an SSH public key. Confirm the resources are Always Free eligible; do not upgrade the account or create paid resources. If Oracle reports no host capacity, wait and retry later.
2. In the VCN's public subnet security list, allow inbound TCP ports `22`, `80`, and `443` (limit SSH to your IP if possible). Ensure the instance has a public IP, an internet gateway, and a default route. Do not expose ports `4000`, `5432`, `6379`, or `9200` publicly.
3. Point a domain's DNS `A` record to the VM's public IPv4. A free DNS subdomain can be used for a demo if you do not own a domain. Wait until DNS resolves. Caddy will automatically request and renew HTTPS; Google and Slack OAuth require the hosted HTTPS callback URLs.
4. SSH into the VM, install Docker Engine and the Compose plugin using [Docker's official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/), then set `vm.max_map_count=262144` on the host for Elasticsearch.
5. Give the VM read-only access to the private GitHub repo (for example, create an SSH deploy key on the VM and add only its public key under repository Deploy Keys), then clone `ujjwalsingh1704/OutBox` into `/opt/outbox`.
6. In `/opt/outbox`, copy `.env.production.example` to `.env.production` and edit it. Set `DOMAIN` to your DNS name, make `JWT_SECRET` and `POSTGRES_PASSWORD` strong random values (use URL-safe letters and numbers for the database password), and fill the Google and Slack client credentials. The real `.env.production` is gitignored and excluded from Docker builds.
7. Add `https://<your-domain>/auth/google/callback` to the Google OAuth client's authorized redirect URIs. Add `https://<your-domain>/api/slack/callback` to the Slack app's redirect URLs. Keep the existing Slack incoming-webhook scope. Save the updated provider settings.
8. Start the app from `/opt/outbox`:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   docker compose --env-file .env.production -f docker-compose.prod.yml ps
   docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 web worker caddy
   ```

   Visit `https://<your-domain>` and check `/health`; the worker must also be running. Use `/admin/queues` to inspect BullMQ jobs.

Oracle blocks outbound SMTP port 25 by default; this app's Ethereal test accounts use port 587. That should avoid the documented port-25 restriction, but verify sending after deployment. Ethereal provides test previews; it is not real customer email delivery. Slack alerts work after connecting Slack from the hosted dashboard. Keep `.env.production` backed up securely; separately back up the Postgres and Docker volumes. Oracle Free Tier is suitable for a demo, not a production availability guarantee.

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
