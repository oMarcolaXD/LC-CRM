"use client"

import { useTransition } from "react"
import { LogOut, Loader2 } from "lucide-react"
import { stopImpersonation } from "@/lib/actions/impersonation"

export function StopImpersonationButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => stopImpersonation())}
      className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold text-amber-950 transition hover:bg-amber-950/20 disabled:opacity-60"
    >
      {isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <LogOut className="h-3.5 w-3.5" />}
      Sair da visão
    </button>
  )
}
