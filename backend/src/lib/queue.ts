import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "email-queue";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
    attempts: 1, // no automatic retries => at-most-once delivery
  },
});

/** Deterministic job id => adding the same email twice is a no-op (idempotent). */
export const jobIdFor = (emailId: string | number) => `email-${emailId}`;

export interface EmailJobData {
  emailId: string;
}
