"use client"

import Link           from "next/link"
import { TriangleAlert } from "lucide-react"
import type { Role } from "@prisma/client"

const PROFILE_PATH: Record<string, string> = {
  ADMIN:        "/admin/perfil",
  COLLABORATOR: "/colaborador/perfil",
  TEACHER:      "/professor/perfil",
  STUDENT:      "/aluno/perfil",
  GUARDIAN:     "/aluno/perfil",
}

interface EmailMissingBannerProps {
  role: Role
}

export function EmailMissingBanner({ role }: EmailMissingBannerProps) {
  const path = PROFILE_PATH[role] ?? "/perfil"

  return (
    <div className="flex items-center gap-3 bg-[#FB8500]/10 border-b border-[#FB8500]/25 px-4 md:px-6 py-2.5">
      <TriangleAlert className="text-[#FB8500] shrink-0 w-4 h-4" />
      <p className="text-sm font-body">
        Você não tem um e-mail cadastrado.{" "}
        <Link href={path} className="font-semibold underline underline-offset-2 hover:text-[#FB8500] transition-colors">
          Adicione agora no seu perfil
        </Link>{" "}
        para facilitar o acesso e confirmar sua conta.
      </p>
    </div>
  )
}
