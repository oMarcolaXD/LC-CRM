import { auth } from "@/lib/auth"
import { StopImpersonationButton } from "./stop-impersonation-button"

/**
 * Banner fixo exibido enquanto um ADMIN está usando "Ver como".
 * Renderiza em todas as áreas (fica no root layout), já que durante a
 * impersonação o admin navega fora do /admin.
 */
export async function ImpersonationBanner() {
  const session = await auth()
  const imp = session?.user?.impersonating
  if (!imp) return null

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md">
      <span className="text-center">
        Você ({imp.realName}) está vendo como{" "}
        <strong>{session!.user.name}</strong>
      </span>
      <StopImpersonationButton />
    </div>
  )
}
