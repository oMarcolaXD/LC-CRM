"use client"

import { useTransition } from "react"
import { Button }        from "@/components/ui/button"
import { Loader2 }       from "lucide-react"
import { togglePackageAction } from "./actions"

export function PackageStatusButton({ id, current }: { id: string; current: string }) {
  const [pending, start] = useTransition()
  if (current === "EXHAUSTED") return null
  const isActive = current === "ACTIVE"
  return (
    <Button size="sm" variant="ghost" disabled={pending}
      className={isActive ? "text-destructive hover:bg-destructive/10 text-xs" : "text-green-600 hover:bg-green-50 text-xs"}
      onClick={() => start(() => togglePackageAction(id, !isActive) as unknown as void)}>
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      {isActive ? "Desativar" : "Ativar"}
    </Button>
  )
}
