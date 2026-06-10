import NextAuth      from "next-auth"
import Credentials   from "next-auth/providers/credentials"
import Google        from "next-auth/providers/google"
import bcrypt        from "bcryptjs"
import { prisma }    from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"
import type { Role } from "@prisma/client"

export { ROLE_HOME }

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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

    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.name  != null) token.name    = session.name
        if (session.image != null) token.picture = session.image

        // ─── Iniciar impersonação ("Ver como") ──────────────────────────────
        // GUARDA DE SEGURANÇA: só permite começar a impersonar se o token real
        // for de um ADMIN. Como token.role NUNCA é sobrescrito durante a
        // impersonação, essa checagem sempre reflete a identidade real — um
        // usuário comum não consegue forjar isso via update() do client.
        const imp = (session as { impersonate?: { id: string; role: Role; name: string; image?: string | null } }).impersonate
        if (imp && token.role === "ADMIN") {
          token.realId     = token.id
          token.realName   = (token.name ?? "") as string
          token.actAsId    = imp.id
          token.actAsRole  = imp.role
          token.actAsName  = imp.name
          token.actAsImage = imp.image ?? null
        }

        // ─── Encerrar impersonação ──────────────────────────────────────────
        // Voltar à própria identidade é sempre seguro.
        if ((session as { stopImpersonate?: boolean }).stopImpersonate) {
          token.actAsId    = undefined
          token.actAsRole  = undefined
          token.actAsName  = undefined
          token.actAsImage = undefined
          token.realId     = undefined
          token.realName   = undefined
        }

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
        if (token.actAsId) {
          // Sessão efetiva = usuário impersonado (dados reais dele nas queries),
          // com a identidade real do admin exposta para o banner/auditoria.
          session.user.id            = token.actAsId   as string
          session.user.role          = token.actAsRole as Role
          session.user.name          = (token.actAsName ?? "") as string
          session.user.image         = (token.actAsImage ?? null) as string | null
          session.user.impersonating = {
            realId:   token.realId   as string,
            realName: token.realName as string,
          }
        } else {
          session.user.id            = token.id   as string
          session.user.role          = token.role as Role
          session.user.impersonating = null
        }
        session.user.phone = token.phone as string | null
      }
      return session
    },
  },
})
