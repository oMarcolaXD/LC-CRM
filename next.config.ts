import type { NextConfig } from "next"

const isDev        = process.env.NODE_ENV === "development"
const isVercelPrev = process.env.VERCEL_ENV === "preview"

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",  value: "on" },
  { key: "X-Frame-Options",         value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only in production — localhost doesn't support HTTPS in dev
  ...(!isDev ? [{
    key:   "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  }] : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : isVercelPrev
        ? "script-src 'self' 'unsafe-inline' https://vercel.live https://*.vercel.live"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://vercel.live",
      // In dev, allow Turbopack HMR WebSocket connections
      isDev
        ? "connect-src 'self' ws://localhost:* wss://localhost:* https://api.z-api.io https://*.supabase.co"
        : isVercelPrev
        ? "connect-src 'self' https://api.z-api.io https://*.supabase.co wss://*.vercel.live https://vercel.live"
        : "connect-src 'self' https://api.z-api.io https://*.supabase.co",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}

export default nextConfig
