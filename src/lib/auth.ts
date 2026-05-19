import NextAuth      from "next-auth"
import Credentials   from "next-auth/providers/credentials"
import Google        from "next-auth/providers/google"
import bcrypt        from "bcryptjs"
import { prisma }    from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"
import type { Role } from "@prisma/client"

export { ROLE_HOME }

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
            user = await prisma.user.findUnique({
              where: { phone: normalized, active: true },
            })
          }
        } catch {
          return null
        }

        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

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

    async jwt({ token, user, account }) {
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
