import { NextResponse, type NextRequest } from "next/server"

/**
 * Apaga o cookie de login e manda para /login.
 *
 * Usado quando a página não acha mais uma sessão válida, mas o navegador ainda
 * tem o cookie — ex.: a conta foi suspensa. Mandar direto para /login daria
 * loop: o middleware só lê o cookie, acha que a pessoa está logada e a joga de
 * volta para dentro do sistema.
 */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url))
  for (const c of req.cookies.getAll()) {
    if (/^(__Secure-)?authjs\.session-token/.test(c.name)) {
      res.cookies.set(c.name, "", { path: "/", maxAge: 0, secure: c.name.startsWith("__Secure-") })
    }
  }
  return res
}
