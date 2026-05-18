import { createHmac } from "crypto"

export function generateCalendarToken(teacherId: string): string {
  const secret = process.env.AUTH_SECRET ?? "calendar-secret-fallback"
  const sig = createHmac("sha256", secret)
    .update(`calendar:${teacherId}`)
    .digest("hex")
  const id64 = Buffer.from(teacherId).toString("base64url")
  return `${id64}_${sig}`
}

export function verifyCalendarToken(token: string): string | null {
  try {
    const underscoreIdx = token.indexOf("_")
    if (underscoreIdx === -1) return null
    const id64 = token.slice(0, underscoreIdx)
    const sig  = token.slice(underscoreIdx + 1)
    if (!id64 || !sig) return null
    const teacherId = Buffer.from(id64, "base64url").toString()
    const expected  = generateCalendarToken(teacherId).split("_")[1]
    return sig === expected ? teacherId : null
  } catch {
    return null
  }
}
