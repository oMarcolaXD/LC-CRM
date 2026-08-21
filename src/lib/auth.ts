import NextAuth      from "next-auth"
import Credentials   from "next-auth/providers/credentials"
import Google        from "next-auth/providers/google"
import { encode as defaultEncode } from "next-auth/jwt"
import bcrypt        from "bcryptjs"
import { prisma }    from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"
import type { Role } from "@prisma/client"

export { ROLE_HOME }

// Validade do token conforme "Lembrar de mim"
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60  // 30 dias
const SESSION_MAX_AGE  = 8 * 60 * 60         // 8 horas

/**
 * Acha o usuário pelo e-mail digitado.
 *
 * Há cadastros gravados com maiúscula ("G4briela@…") e o Postgres compara
 * diferenciando caixa: quem digita tudo minúsculo simplesmente não entra. A
 * busca sem diferenciar caixa é a rede de segurança, mas só vale quando há um
 * único candidato — existem e-mails repetidos em grafias diferentes no banco, e
 * adivinhar em qual cadastro logar seria pior do que recusar.
 */
async function findActiveUserByEmail(email: string) {
  const exact = await prisma.user.findUnique({ where: { email, active: true } })
  if (exact) return exact

  const matches = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" }, active: true },
    take:  2,
  })
  return matches.length === 1 ? matches[0] : null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // A validade real do token (exp) é decidida aqui, com base em token.remember.
  // O cookie em si dura 30 dias (auth.config.ts); quando "não lembrar", o token
  // interno expira em 8h e o usuário precisa logar de novo.
  jwt: {
    encode(params) {
      const remember = (params.token as { remember?: boolean } | undefined)?.remember
      return defaultEncode({
        ...params,
        maxAge: remember === false ? SESSION_MAX_AGE : REMEMBER_MAX_AGE,
      })
    },
  },
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
        remember:     { label: "Lembrar de mim",     type: "text"     },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const input = parsed.data.emailOrPhone.trim()
        const isEmail = input.includes("@")

        let user = null
        try {
          if (isEmail) {
            user = await findActiveUserByEmail(input)
          } else {
            const normalized = input.replace(/\D/g, "")
            if (normalized.length < 8) return null
            user = await prisma.user.findFirst({
              where: { phone: normalized, active: true },
            })
          }
        } catch (e) {
          // Loga o erro REAL do banco (conexão, schema, etc.) em vez de mascará-lo
          // como credencial inválida — facilita diagnóstico de falhas de login.
          console.error("[auth] Falha ao consultar usuário no login:", e instanceof Error ? `${e.name}: ${e.message}` : e)
          return null
        }

        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        if (user.role === "STUDENT") throw new Error("student_login_disabled")

        const remember = credentials?.remember === "true"

        return { id: user.id, name: user.name, email: user.email ?? null, image: user.avatar, role: user.role, phone: user.phone, remember }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false
        const existingUser = await findActiveUserByEmail(user.email)
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
        const dbUser = await findActiveUserByEmail(user.email)
        if (dbUser) {
          token.id    = dbUser.id
          token.role  = dbUser.role
          token.phone = dbUser.phone ?? null
        }
        token.remember = true
      } else if (user) {
        token.id    = user.id ?? ""
        token.role  = (user as { id: string; role: Role }).role
        token.phone = (user as { phone?: string | null }).phone ?? null
        token.remember = (user as { remember?: boolean }).remember ?? true
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
