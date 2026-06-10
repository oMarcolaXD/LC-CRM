"use server"

import { auth, unstable_update, ROLE_HOME } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

/**
 * Impersonação ("Ver como") — permite que um ADMIN visualize o sistema com a
 * identidade (e os dados reais) de outro usuário, para conferir dashboards e
 * comportamento por perfil.
 *
 * Segurança:
 *  - Só ADMIN inicia (verificado aqui E reforçado na guarda do callback jwt).
 *  - ADMIN não impersona outro ADMIN nem a si mesmo.
 *  - token.id/token.role do admin nunca são sobrescritos → sempre dá pra voltar.
 *  - Início e fim ficam registrados em ActivityLog (auditoria).
 */

export async function startImpersonation(targetUserId: string) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN" || session.user.impersonating) {
    throw new Error("Sem permissão para impersonar")
  }

  const adminId = session.user.id

  const target = await prisma.user.findUnique({
    where:  { id: targetUserId },
    select: { id: true, name: true, role: true, avatar: true, active: true },
  })

  if (!target)              throw new Error("Usuário não encontrado")
  if (!target.active)       throw new Error("Usuário inativo não pode ser visualizado")
  if (target.id === adminId) throw new Error("Você já está logado como você mesmo")
  if (target.role === "ADMIN") throw new Error("Não é possível ver como outro administrador")

  await prisma.activityLog.create({
    data: {
      userId:     adminId,
      action:     "IMPERSONATE_START",
      entityType: "User",
      entityId:   target.id,
      metadata:   { targetName: target.name, targetRole: target.role },
    },
  })

  await unstable_update({
    impersonate: { id: target.id, role: target.role, name: target.name, image: target.avatar },
  } as never)

  redirect(ROLE_HOME[target.role] ?? "/login")
}

export async function stopImpersonation() {
  const session = await auth()
  const impersonating = session?.user?.impersonating
  // Só faz sentido se houver um admin real por trás da sessão atual.
  if (!impersonating) throw new Error("Você não está em modo de visualização")

  await prisma.activityLog.create({
    data: {
      userId:     impersonating.realId,
      action:     "IMPERSONATE_STOP",
      entityType: "User",
      entityId:   session!.user.id,
      metadata:   { viewedAs: session!.user.name },
    },
  })

  await unstable_update({ stopImpersonate: true } as never)

  redirect("/admin/usuarios")
}
