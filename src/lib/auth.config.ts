import type { NextAuthConfig } from "next-auth"
import type { Role }           from "@prisma/client"

// Mapeamento role → home (sem Prisma — seguro para Edge runtime)
export const ROLE_HOME: Record<string, string> = {
  ADMIN:        "/admin/dashboard",
  COLLABORATOR: "/colaborador/dashboard",
  TEACHER:      "/professor/dashboard",
  STUDENT:      "/aluno/dashboard",
  GUARDIAN:     "/aluno/dashboard",
}

// Config mínima para o middleware Edge — sem callbacks, sem Prisma, sem bcrypt
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session:   { strategy: "jwt", maxAge: 8 * 60 * 60 },  // 8 horas
  pages:     { signIn: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        // Impersonação: se um ADMIN está "vendo como" outro usuário, a sessão
        // efetiva (id/role) passa a ser a do alvo. token.id/token.role seguem
        // sendo os do admin real — por isso o middleware roteia o admin como se
        // fosse o perfil impersonado (e o impede de voltar ao /admin enquanto isso).
        if (token.actAsId) {
          session.user.id   = token.actAsId   as string
          session.user.role = token.actAsRole as Role
        } else {
          session.user.id   = token.id   as string
          session.user.role = token.role as Role
        }
      }
      return session
    },
  },
}
