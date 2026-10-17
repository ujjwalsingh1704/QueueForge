import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
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

  // Production Docker image includes the built dashboard; local development keeps using Vite.
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/auth/") || req.path.startsWith("/admin/")) {
        return next();
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => console.log(`[api] listening on ${config.port}  (queues: /admin/queues)`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
