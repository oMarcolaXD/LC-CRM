import { randomInt }  from "crypto"
import { prisma }     from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/** Cliente Prisma ou transação — o R.A. é gerado dentro da mesma tx do cadastro. */
type Db = Prisma.TransactionClient | typeof prisma

const TENTATIVAS = 20

/**
 * Gera o R.A. (Registro do Aluno): 6 dígitos aleatórios, nunca começando com
 * zero. Sorteia e confere no banco até achar um livre — com 900 mil combinações
 * e poucos milhares de alunos, a colisão é rara e resolvida na primeira retentativa.
 *
 * A unicidade real é garantida pelo índice único em `students.ra`; esta função
 * só evita que o erro chegue ao usuário.
 */
export async function gerarRA(db: Db = prisma): Promise<string> {
  for (let i = 0; i < TENTATIVAS; i++) {
    const ra = String(randomInt(100000, 1000000))
    const existe = await db.student.findUnique({ where: { ra }, select: { id: true } })
    if (!existe) return ra
  }
  throw new Error("Não foi possível gerar um R.A. único — tente novamente")
}

/** Formata o R.A. para exibição (ex.: "482137" → "R.A. 482137"). */
export function formatarRA(ra: string): string {
  return `R.A. ${ra}`
}
