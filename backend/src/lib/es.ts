import { Client } from "@elastic/elasticsearch";
import { config } from "../config";
import type { EmailRow } from "./db";

export const es = new Client({ node: config.esUrl });
const INDEX = "emails";

export async function ensureIndex() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            user_id: { type: "integer" },
            to_email: { type: "keyword" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            scheduled_at: { type: "date" },
            sent_at: { type: "date" },
          },
        },
      });
    }
  } catch (e) {
    console.warn("[es] unavailable, search disabled:", (e as Error).message);
  }
}

/** Best effort: search being down must never block sending. */
export async function indexEmail(row: EmailRow) {
  try {
    await es.index({
      index: INDEX,
      id: String(row.id),
      document: {
        user_id: row.user_id,
        to_email: row.to_email,
        subject: row.subject,
        body: row.body,
        status: row.status,
        scheduled_at: row.scheduled_at,
        sent_at: row.sent_at,
      },
    });
  } catch (e) {
    console.warn("[es] index failed:", (e as Error).message);
  }
}

export async function searchEmails(userId: number, q: string) {
  const res = await es.search({
    index: INDEX,
    size: 100,
    query: {
      bool: {
        filter: [{ term: { user_id: userId } }],
        must: [{ multi_match: { query: q, fields: ["subject", "body", "to_email"], fuzziness: "AUTO" } }],
      },
    },
  });
  return res.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) }));
}
