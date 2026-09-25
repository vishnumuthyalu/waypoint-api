import Redis from "ioredis";

export const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// redirect-service caches links under link:{code}; clear it when a link changes
export async function invalidate(code: string) {
  await redis?.del(`link:${code}`).catch((err) => console.error("cache invalidate failed", err));
}