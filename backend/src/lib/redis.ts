import IORedis from "ioredis";
import { config } from "../config";

// maxRetriesPerRequest must be null for BullMQ workers
export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// Atomic "increment if under limit" – safe across any number of workers/instances.
redis.defineCommand("consumeSlot", {
  numberOfKeys: 1,
  lua: `
    local c = tonumber(redis.call('GET', KEYS[1]) or '0')
    if c >= tonumber(ARGV[1]) then return 0 end
    redis.call('INCR', KEYS[1])
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
    return 1
  `,
});

declare module "ioredis" {
  interface RedisCommander<Context> {
    consumeSlot(key: string, limit: number, ttlMs: number): Promise<number>;
  }
}
