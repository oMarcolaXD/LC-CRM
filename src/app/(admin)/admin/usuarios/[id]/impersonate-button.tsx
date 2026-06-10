"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Eye, Loader2 } from "lucide-react"
import { startImpersonation } from "@/lib/actions/impersonation"

interface ImpersonateButtonProps {
  id:   string
  name: string
}

export function ImpersonateButton({ id, name }: ImpersonateButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) { setConfirming(true); return }
    setError(null)
    startTransition(async () => {
      try {
        await startImpersonation(id)
      } catch (e) {
        // redirect() lança NEXT_REDIRECT — não é erro de verdade.
        const msg = e instanceof Error ? e.message : "Falha ao iniciar visualização"
        if (msg.includes("NEXT_REDIRECT")) return
        setError(msg)
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Ver o sistema como {name.split(" ")[0]}?
        </span>
        <Button size="sm" disabled={isPending} onClick={handleClick}>
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Confirmar
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    )
  }

  return (
    <Button variant="outline" onClick={handleClick}>
      <Eye className="mr-2 h-4 w-4" />
      Ver como este usuário
    </Button>
  )
}
