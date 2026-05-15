import NextAuth        from "next-auth"
import { NextResponse } from "next/server"
import { authConfig, ROLE_HOME } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn   = !!req.auth
  const isAuthPage   = pathname.startsWith("/login") || pathname.startsWith("/registro")

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn && isAuthPage) {
    const role = req.auth?.user?.role as string
    const home = ROLE_HOME[role] ?? "/login"
    return NextResponse.redirect(new URL(home, req.url))
  }

  // Redireciona para home do role se tentar acessar área de outro perfil
  if (isLoggedIn) {
    const role = req.auth?.user?.role as string
    const home = ROLE_HOME[role]
    const isWrongArea =
      (pathname.startsWith("/admin")       && role !== "ADMIN") ||
      (pathname.startsWith("/colaborador") && !["ADMIN", "COLLABORATOR"].includes(role)) ||
      (pathname.startsWith("/professor")   && !["ADMIN", "TEACHER"].includes(role)) ||
      (pathname.startsWith("/aluno")       && !["STUDENT", "GUARDIAN"].includes(role))

    if (isWrongArea && home) {
      return NextResponse.redirect(new URL(home, req.url))
    }
  }

  const response = NextResponse.next()
  response.headers.set("x-pathname", pathname)
  return response
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|sw\\.js|logo\\.svg|apple-touch-icon\\.png|favicon-32x32\\.png).*)"],
}
