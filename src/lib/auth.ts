import NextAuth      from "next-auth"
import Credentials   from "next-auth/providers/credentials"
import bcrypt        from "bcryptjs"
import { prisma }    from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"
import type { Role } from "@prisma/client"

export { ROLE_HOME }

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email", type: "email"    },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email, active: true },
        })
        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        return { id: user.id, name: user.name, email: user.email, image: user.avatar, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id ?? ""
        token.role = (user as { id: string; role: Role }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id   as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
})
