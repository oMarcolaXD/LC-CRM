import type { NextAuthConfig, Session } from "next-auth"
import type { JWT }  from "next-auth/jwt"
import type { User } from "next-auth"
import type { Role } from "@prisma/client"

export const ROLE_HOME: Record<string, string> = {
  ADMIN:        "/admin/dashboard",
  COLLABORATOR: "/colaborador/dashboard",
  TEACHER:      "/professor/dashboard",
  STUDENT:      "/aluno/dashboard",
  GUARDIAN:     "/aluno/dashboard",
}

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages:   { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }: { token: JWT; user: User | undefined }) {
      if (user) {
        token.id   = user.id
        token.role = (user as User & { role: Role }).role
      }
      return token
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id   = token.id   as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
} satisfies NextAuthConfig
