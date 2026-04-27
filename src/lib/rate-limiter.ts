interface WindowEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, WindowEntry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function isRateLimitBypassed(): boolean {
  return process.env.RATE_LIMIT_BYPASS === "true";
}

class RateLimiterUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimiterUnavailableError";
  }
}

interface RateLimiterAdapter {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export type RateLimiterBackend = "memory" | "redis" | "upstash" | "unconfigured";

class MemoryRateLimiterAdapter implements RateLimiterAdapter {
  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = memoryStore.get(key);

    if (!existing || existing.resetAt < now) {
      const resetAt = now + windowMs;
      memoryStore.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }

    existing.count += 1;
    return { count: existing.count, resetAt: existing.resetAt };
  }
}

type UpstashPipelineItem<T> = {
  result: T;
  error?: string;
};

class UpstashRateLimiterAdapter implements RateLimiterAdapter {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private async pipeline<T>(commands: unknown[][]): Promise<UpstashPipelineItem<T>[]> {
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new RateLimiterUnavailableError(`Upstash request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as UpstashPipelineItem<T>[];
    return data;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1_000));

    const first = await this.pipeline<number | string>([
      ["INCR", key],
      ["PTTL", key],
      ["EXPIRE", key, ttlSeconds, "NX"],
    ]);

    const countRaw = first[0]?.result;
    const pttlRaw = first[1]?.result;

    const count = typeof countRaw === "number" ? countRaw : Number(countRaw ?? 0);
    let pttlMs = typeof pttlRaw === "number" ? pttlRaw : Number(pttlRaw ?? -1);

    if (!Number.isFinite(count) || count <= 0) {
      throw new RateLimiterUnavailableError("Rate limiter returned invalid counter.");
    }

    if (!Number.isFinite(pttlMs) || pttlMs < 0) {
      await this.pipeline<number>([["PEXPIRE", key, windowMs]]);
      pttlMs = windowMs;
    }

    return {
      count,
      resetAt: now + pttlMs,
    };
  }
}

class RedisUrlRateLimiterAdapter implements RateLimiterAdapter {
  private client: import("ioredis").default | null = null;

  private getClient(): import("ioredis").default {
    if (this.client) return this.client;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis") as typeof import("ioredis").default;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new RateLimiterUnavailableError("REDIS_URL is required for Redis rate limiter.");
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    return this.client;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const client = this.getClient();
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1_000));

    try {
      if (client.status === "wait") {
        await client.connect();
      }

      const [countRaw, pttlRaw] = await client
        .multi()
        .incr(key)
        .expire(key, ttlSeconds, "NX")
        .pttl(key)
        .exec()
        .then((result) => {
          if (!result || result.length < 3) {
            throw new RateLimiterUnavailableError("Redis multi response is invalid.");
          }
          return [result[0]?.[1], result[2]?.[1]];
        });

      const count = typeof countRaw === "number" ? countRaw : Number(countRaw ?? 0);
      let pttlMs = typeof pttlRaw === "number" ? pttlRaw : Number(pttlRaw ?? -1);

      if (!Number.isFinite(count) || count <= 0) {
        throw new RateLimiterUnavailableError("Redis returned invalid counter.");
      }

      if (!Number.isFinite(pttlMs) || pttlMs < 0) {
        await client.pexpire(key, windowMs);
        pttlMs = windowMs;
      }

      return {
        count,
        resetAt: now + pttlMs,
      };
    } catch (error) {
      throw new RateLimiterUnavailableError(
        error instanceof Error ? `Redis rate limiter failed: ${error.message}` : "Redis rate limiter failed.",
      );
    }
  }
}

function getAdapter(): RateLimiterAdapter {
  const backend = getRateLimiterBackend();

  if (backend === "redis") {
    return new RedisUrlRateLimiterAdapter();
  }

  if (backend === "upstash") {
    return new UpstashRateLimiterAdapter(upstashUrl, upstashToken);
  }

  if (backend === "memory") {
    return new MemoryRateLimiterAdapter();
  }

  throw new RateLimiterUnavailableError(
    "Rate limiter backend is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production.",
  );
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export function getRateLimiterBackend(): RateLimiterBackend {
  if (process.env.REDIS_URL) return "redis";
  if (upstashUrl && upstashToken) return "upstash";
  if (process.env.NODE_ENV !== "production") return "memory";
  return "unconfigured";
}

let cachedAdapter: RateLimiterAdapter | null = null;

function getAdapterCached(): RateLimiterAdapter {
  if (cachedAdapter) return cachedAdapter;
  cachedAdapter = getAdapter();
  return cachedAdapter;
}

export function isRateLimiterUnavailableError(error: unknown): error is RateLimiterUnavailableError {
  return error instanceof RateLimiterUnavailableError;
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isRateLimitBypassed()) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
    };
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new RateLimiterUnavailableError("Invalid rate limit configuration.");
  }

  const namespacedKey = `rl:${key}`;
  const adapter = getAdapterCached();
  const { count, resetAt } = await adapter.increment(namespacedKey, windowMs);

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, remaining, resetAt };
}

export function createRateLimitHeaders(limit: number, remaining: number, resetAt: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
