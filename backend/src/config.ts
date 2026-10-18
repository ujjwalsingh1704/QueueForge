import "dotenv/config";

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

export const config = {
  isProduction: process.env.NODE_ENV === "production",
  port: num(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:4000",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  databaseUrl: process.env.DATABASE_URL ?? "postgres://outbox:outbox@localhost:5433/outbox",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  esUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
  },
  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 5),
  minDelayMs: num(process.env.MIN_DELAY_BETWEEN_EMAILS_MS, 2000),
  maxPerHour: num(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 200),
  senderCount: num(process.env.SENDER_COUNT, 3),
};

if (config.isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret")) {
  throw new Error("JWT_SECRET must be set to a strong secret in production");
}
