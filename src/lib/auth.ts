import NextAuth      from "next-auth"
import Credentials   from "next-auth/providers/credentials"
import Google        from "next-auth/providers/google"
import bcrypt        from "bcryptjs"
import { prisma }    from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"
import type { Role } from "@prisma/client"

export { ROLE_HOME }

// Diagnóstico: identifica QUAL banco o app está usando (só o ref do projeto, sem expor a senha)
function dbRef(): string {
  try {
    const m = (process.env.DATABASE_URL || "").match(/:\/\/([^:@/]+)/)
    return m?.[1] ?? "unknown"
  } catch {
    return "unknown"
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        emailOrPhone: { label: "E-mail ou Telefone", type: "text"     },
        password:     { label: "Senha",              type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const input = parsed.data.emailOrPhone.trim()
        const isEmail = input.includes("@")

        let user = null
        try {
          if (isEmail) {
            user = await prisma.user.findUnique({
              where: { email: input, active: true },
            })
          } else {
            const normalized = input.replace(/\D/g, "")
            if (normalized.length < 8) return null
            user = await prisma.user.findFirst({
              where: { phone: normalized, active: true },
            })
          }
        } catch (e) {
          console.error("[authorize] ERRO ao consultar banco:", e instanceof Error ? `${e.name}: ${e.message}` : e)
          return null
        }

        if (!user) {
          console.error(`[authorize] usuario NAO encontrado para: ${input} | db=${dbRef()}`)
          return null
        }

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) {
          console.error(`[authorize] senha NAO confere para: ${user.email ?? user.phone} | db=${dbRef()} | hashPrefix=${(user.password ?? "").slice(0, 7)}`)
          return null
        }

        if (user.role === "STUDENT") throw new Error("student_login_disabled")

        return { id: user.id, name: user.name, email: user.email ?? null, image: user.avatar, role: user.role, phone: user.phone }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email, active: true },
        })
        if (!existingUser) return "/login?error=not_registered"
      }
      return true
    },

    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.name  != null) token.name    = session.name
        if (session.image != null) token.picture = session.image
        return token
      }
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
        if (dbUser) {
          token.id    = dbUser.id
          token.role  = dbUser.role
          token.phone = dbUser.phone ?? null
        }
      } else if (user) {
        token.id    = user.id ?? ""
        token.role  = (user as { id: string; role: Role }).role
        token.phone = (user as { phone?: string | null }).phone ?? null
      }
      return token
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id    as string
        session.user.role  = token.role  as Role
        session.user.phone = token.phone as string | null
      }
      return session
    },
  },
})
