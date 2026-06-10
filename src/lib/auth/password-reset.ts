import crypto      from "crypto"
import { prisma }  from "@/lib/prisma"

const TOKEN_BYTES   = 32
const TOKEN_TTL_MS  = 60 * 60 * 1000 // 1 hora

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * Gera um novo token de redefinição de senha para o usuário, invalidando
 * quaisquer tokens anteriores ainda não utilizados. Retorna o token em
 * texto puro (a ser enviado por e-mail) — apenas o hash é persistido.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token     = crypto.randomBytes(TOKEN_BYTES).toString("hex")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
  ])

  return token
}

/**
 * Valida um token de redefinição de senha. Retorna o userId associado se o
 * token existir, não tiver sido usado e ainda estiver dentro da validade.
 */
export async function validatePasswordResetToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token)

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt < new Date()) return null

  return { userId: record.userId }
}

/**
 * Marca o token como utilizado, impedindo reuso (links de e-mail são de uso único).
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await prisma.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null },
    data:  { usedAt: new Date() },
  })
}
