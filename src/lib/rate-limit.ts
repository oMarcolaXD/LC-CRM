import { Redis } from "@upstash/redis"

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const MAX_ATTEMPTS    = 5
const WINDOW_SECONDS  = 15 * 60  // 15 minutos

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (process.env.NODE_ENV === "development") return { allowed: true, retryAfterSeconds: 0 }
  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS)
    }
    if (count > MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key)
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS }
    }
    return { allowed: true, retryAfterSeconds: 0 }
  } catch {
    // Redis indisponível ou sem permissão — permite a requisição
    return { allowed: true, retryAfterSeconds: 0 }
  }
}
