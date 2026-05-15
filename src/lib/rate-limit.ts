// Rate limiting em memória — adequado para instância única (Vercel serverless)
// Para múltiplas instâncias em produção, migrar para Upstash Redis.

interface Attempt {
  count:     number
  resetAt:   number
}

const store = new Map<string, Attempt>()

const MAX_ATTEMPTS  = 5
const WINDOW_MS     = 15 * 60 * 1000  // 15 minutos

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now    = Date.now()
  const entry  = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  entry.count++
  return { allowed: true, retryAfterSeconds: 0 }
}
