import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", db: "connected" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error"
    const hint = msg.includes("Authentication failed")
      ? "DATABASE_URL com credenciais inválidas — verifique a senha no Vercel (sem caracteres especiais como @, #, !)."
      : msg
    return NextResponse.json({ status: "error", db: "disconnected", hint }, { status: 503 })
  }
}
