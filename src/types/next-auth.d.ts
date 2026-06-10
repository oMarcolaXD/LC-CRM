import type { Role } from "@prisma/client"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id:    string
      role:  Role
      phone: string | null
      // Presente apenas quando um ADMIN está usando "Ver como" (impersonação).
      // Carrega a identidade real do admin por trás da sessão visualizada.
      impersonating?: { realId: string; realName: string } | null
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:    string
    role:  Role
    phone: string | null
    // ─── Impersonação ("Ver como") ───────────────────────────────────────
    // Identidade que está sendo visualizada (alvo). Quando preenchida, a
    // sessão efetiva passa a ser deste usuário, mas token.id/token.role
    // continuam sendo os do ADMIN real (base da guarda de segurança).
    actAsId?:    string
    actAsRole?:  Role
    actAsName?:  string
    actAsImage?: string | null
    // Snapshot da identidade real do admin, para o banner e a auditoria.
    realId?:   string
    realName?: string
  }
}
