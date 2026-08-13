/**
 * Localiza o cadastro de professor do usuário logado.
 *
 * O vínculo é pelo `userId` da sessão, nunca pelo e-mail. O e-mail vive dentro
 * do JWT, que dura até 30 dias: se a secretaria corrigir o e-mail do professor
 * (ou trocar a grafia), o token em circulação continua apontando para o e-mail
 * antigo e a busca não acha ninguém — foi assim que as aulas "sumiram" da
 * agenda de vários professores, sem erro nenhum na tela. O id do usuário não
 * muda, então a mesma sessão continua valendo.
 */

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

/** Nunca casa com nenhum registro — evita cair num `findFirst` sem filtro. */
const NENHUM: Prisma.TeacherWhereInput = { id: "__sem_sessao__" }

export function teacherWhereForSession(session: Session | null): Prisma.TeacherWhereInput {
  const userId = session?.user?.id
  if (userId) return { userId }

  // Sessão antiga, emitida antes de o id entrar no token: cai no e-mail.
  const email = session?.user?.email?.trim()
  if (email) return { user: { email: { equals: email, mode: "insensitive" } } }

  return NENHUM
}
