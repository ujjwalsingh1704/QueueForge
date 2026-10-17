import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config";
import { migrate } from "./lib/db";
import { ensureSenders } from "./lib/senders";
import { ensureIndex } from "./lib/es";
import { emailQueue } from "./lib/queue";
import { reconcile } from "./lib/scheduler";
import { authRouter } from "./routes/auth";
import { emailsRouter } from "./routes/emails";
import { slackRouter } from "./routes/slack";

async function main() {
  await migrate();
  await ensureSenders();
  await ensureIndex();
  await reconcile();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  // Live BullMQ dashboard
  const board = new ExpressAdapter();
  board.setBasePath("/admin/queues");
  createBullBoard({ queues: [new BullMQAdapter(emailQueue) as any], serverAdapter: board });
  app.use("/admin/queues", board.getRouter());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/slack", slackRouter);

  app.listen(config.port, () => console.log(`[api] http://localhost:${config.port}  (queues: /admin/queues)`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
