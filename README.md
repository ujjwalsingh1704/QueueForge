# Outbox

**Schedule test emails, control sending pace, and track every message from one dashboard.**

Outbox is a full-stack email scheduling project built to demonstrate reliable background jobs, per-sender rate limits, and Slack alerts. Compose a message, add recipients or import a CSV, send now or schedule for later, then follow each email as it moves through the queue.

> **Demo status:** The app runs locally. It does not currently have a public hosting link. Outbox uses Ethereal test email accounts, so messages are for testing and preview; they are not delivered to real recipients.

## What you can do

- **Write and schedule email batches.** Add recipients directly or import them from a CSV or text file. Choose Send now or Send later.
- **Control the pace.** Set the delay between emails and an hourly limit for each sender.
- **Keep queued emails safe.** Postgres stores email records, while Redis and BullMQ hold delayed jobs so they can resume after a restart.
- **Handle rate limits automatically.** When a sender reaches its hourly limit, Outbox defers the remaining emails to the next hour instead of dropping them.
- **Get Slack alerts.** Connect Slack to receive one alert when a sender reaches its hourly limit.
- **Find and inspect messages.** Search email records, see Scheduled and Sent lists, open message details, and preview test emails.
- **Inspect the queue.** Open the live Bull Board dashboard at `/admin/queues`.

## How it works

1. Outbox saves each recipient's email as a row in Postgres.
2. BullMQ adds a delayed job to Redis for each email.
3. A separate worker sends due emails through Nodemailer and updates their status.
4. The worker applies the hourly limit and global send spacing. If the hourly limit is reached, it delays that email until the next hour and sends a Slack alert if Slack is connected.
5. Elasticsearch indexes email records for search. Search indexing is best-effort and does not block sending.

## Technology

| Part | Technology |
|---|---|
| Dashboard | React, TypeScript, Vite, Tailwind CSS |
| API and authentication | Node.js, Express, TypeScript, Google OAuth |
| Scheduling and background work | BullMQ, Redis |
| Persistent records | PostgreSQL |
| Search | Elasticsearch |
| Test email | Nodemailer, Ethereal |
| Alerts | Slack incoming webhooks |
| Production web serving | Docker Compose, Caddy, automatic HTTPS |

## Run locally

### Requirements

- Git
- Node.js 22 or newer and npm
- Docker Desktop (or Docker Engine with the Compose plugin)

### 1. Get the project and start its services

From a terminal:

```bash
git clone https://github.com/ujjwalsingh1704/OutBox.git
cd OutBox
docker compose up -d
```

The Compose file starts PostgreSQL, Redis, and Elasticsearch. PostgreSQL is available locally on port `5433`; the other local service ports are `6379` and `9200`.

### 2. Configure and start the API

Create the backend environment file. In PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

On macOS or Linux:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set up Google OAuth as described below. Then start the API:

```bash
cd backend
npm install
npm run dev:api
```

The API runs at `http://localhost:4000`.

### 3. Start the worker

Open a second terminal at the project root and run:

```bash
cd backend
npm run dev:worker
```

The worker processes emails when they are due.

### 4. Start the dashboard

Open a third terminal at the project root and run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Connect Google sign-in

Create a Google OAuth **Web application** client and add this authorized redirect URI:

```text
http://localhost:4000/auth/google/callback
```

Put the client ID and secret in `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The login screen needs Google OAuth to sign in.

### Connect Slack (optional)

Create a Slack app with the `incoming-webhook` OAuth scope and add this redirect URL:

```text
http://localhost:4000/api/slack/callback
```

Set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` in `backend/.env`. Slack requires HTTPS redirect URLs for hosted deployments.

### Email previews

Outbox creates Ethereal test sender accounts automatically on first API startup. No SMTP account setup is needed locally. After an email is sent, use its preview link to view the message in Ethereal. Ethereal is a testing service, not a real email delivery provider.

### Useful local URLs

- Dashboard: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Queue dashboard: `http://localhost:4000/admin/queues`

## Configuration

`backend/.env.example` lists the available settings. The most commonly changed ones are:

| Setting | Default | What it controls |
|---|---:|---|
| `WORKER_CONCURRENCY` | `5` | Number of jobs the worker can process concurrently |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum global spacing between sends, in milliseconds |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Default hourly cap for each sender |
| `SENDER_COUNT` | `3` | Number of Ethereal test senders created on first startup |

The compose screen can set an hourly limit and a delay for an individual batch. Never commit `.env` files or production secrets. Use a long, random `JWT_SECRET` for production; the local example is for development only.

## Deploy with Docker

The root `Dockerfile` builds the dashboard and API into one image. `docker-compose.prod.yml` runs that image as an API and a separate worker, plus PostgreSQL, Redis, Elasticsearch, and Caddy for HTTPS. It is designed for a Linux VM with a public IP and a DNS name.

### Free hosted demo on Render

The checked-in [`render.yaml`](./render.yaml) creates the dashboard, API, and queue worker as one Render web service, plus free Render Postgres and Key Value services. Render needs access to this repository through its GitHub integration. After the first deploy, add `https://<your-render-service>.onrender.com/auth/google/callback` as an authorized redirect URI in Google Cloud, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Render service's environment settings. Slack can be connected later by adding its client ID and secret there and registering `https://<your-render-service>.onrender.com/api/slack/callback` in the Slack app.

This is suitable for a short portfolio demo, with free-tier limits: Render sleeps after 15 minutes without traffic and may take about a minute to wake. Render's free Postgres expires after 30 days, and its free Key Value service does not persist queue data across restarts. Render also blocks outbound SMTP on ports 25, 465, and 587, so the current Ethereal SMTP sender will not deliver from Render. The app can be opened and explored, but sending needs an email provider/API integration or a host that allows SMTP. Elasticsearch is optional at startup, but search requires a reachable Elasticsearch service.

For a free Oracle Cloud deployment, use only resources labeled **Always Free eligible**. Oracle currently lists an Always Free Ampere allocation equivalent to **2 OCPUs and 12 GB RAM**, 200 GB of combined block storage, and 10 TB/month of outbound data in the tenancy's home region. Capacity can be limited, and account verification may be required. [Check Oracle's current Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) and [Free Tier terms](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

### Production deployment outline

1. Create an Ubuntu 24.04 ARM64 VM in your Oracle home region. Confirm the VM and storage are marked Always Free eligible; do not upgrade the account or create paid resources.
2. Allow inbound TCP ports `22`, `80`, and `443` in the VM firewall/security list. Keep ports `4000`, `5432`, `6379`, and `9200` private.
3. Point a DNS `A` record (a free subdomain works for a demo) to the VM's public IPv4 address. Caddy will request and renew HTTPS certificates after DNS resolves.
4. Install Docker Engine and the Docker Compose plugin using [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Set `vm.max_map_count=262144` on the VM for Elasticsearch.
5. Clone this private GitHub repository onto the VM using a read-only deploy key.
6. Copy `.env.production.example` to `.env.production`. Set `DOMAIN`, a strong random `JWT_SECRET`, a strong `POSTGRES_PASSWORD`, and your Google/Slack OAuth credentials.
7. Add the hosted callbacks to your OAuth apps:
   - Google: `https://<your-domain>/auth/google/callback`
   - Slack: `https://<your-domain>/api/slack/callback`
8. Start the stack from the project directory:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   docker compose --env-file .env.production -f docker-compose.prod.yml ps
   docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 web worker caddy
   ```

   Visit `https://<your-domain>` and check `https://<your-domain>/health`. Confirm both the `web` and `worker` services are running.

Ethereal uses SMTP on port `587`; verify outbound SMTP access from your host before relying on email sending. Slack alerts begin working after connecting Slack in the hosted dashboard. Back up `.env.production` securely, along with the PostgreSQL and Docker volumes. Free-tier hosting is suitable for a demo and does not guarantee production availability.

## Design notes and trade-offs

- **Rate limits are shared.** Redis atomically tracks each sender's hourly usage across workers. A Redis Lua script prevents two workers from consuming the same remaining slot.
- **Queue recovery is automatic.** On API startup, Outbox checks for scheduled database rows that are missing from Redis and re-enqueues them.
- **Duplicate sends are guarded.** Before sending, a worker atomically claims the email row. The delivery model is at-most-once: if a worker crashes after claiming an email, that row can remain `processing` and is not automatically retried.
- **Slack alerts are deduplicated.** Outbox sends at most one rate-limit alert per sender and hourly window. If Slack is not connected, the email is still deferred and sending can continue later.
- **The global send delay applies across the queue.** It is not a separate delay for each sender.
- **The UI follows the supplied design references.** Attachments and email/password sign-in are not implemented.
