"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { deleteUserAction } from "./actions"

interface DeleteUserButtonProps {
  id:   string
  name: string
}

export function DeleteUserButton({ id, name }: DeleteUserButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) { setConfirming(true); return }

    setError(null)
    startTransition(async () => {
      const res = await deleteUserAction(id)
      if (res.error) {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  if (error) {
    return (
      <span className="text-xs text-destructive whitespace-nowrap">{error}</span>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
          Excluir {name.split(" ")[0]}?
        </span>
        <Button
          size="sm" variant="destructive" className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={handleClick}
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
        </Button>
        <Button
          size="sm" variant="ghost" className="h-7 px-2 text-xs"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="icon" variant="ghost"
      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={handleClick}
      title={`Excluir ${name}`}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )
}
