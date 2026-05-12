import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { ROLE_HOME } from "@/lib/auth"
import type { Role } from "@prisma/client"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn   = !!req.auth
  const isAuthPage   = pathname.startsWith("/login") || pathname.startsWith("/registro")

  // Redireciona para login se não autenticado
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redireciona para o dashboard correto se já logado e tentar acessar /login
  if (isLoggedIn && isAuthPage) {
    const role = req.auth?.user?.role as Role
    const home = ROLE_HOME[role] ?? "/login"
    return NextResponse.redirect(new URL(home, req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
}
