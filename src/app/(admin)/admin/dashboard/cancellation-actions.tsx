"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { approveLessonCancellationAction, rejectLessonCancellationAction } from "@/lib/actions/lesson-cancellation"
import { Loader2, Check, X } from "lucide-react"

interface Props {
  requestId: string
}

export function CancellationActions({ requestId }: Props) {
  const router = useRouter()
  const [rejectMode, setRejectMode] = useState(false)
  const [note, setNote]             = useState("")
  const [pending, start]            = useTransition()

  function handleApprove() {
    start(async () => {
      try {
        await approveLessonCancellationAction(requestId)
        toast.success("Aula cancelada e saldo devolvido")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao aprovar")
      }
    })
  }

  function handleReject() {
    start(async () => {
      try {
        await rejectLessonCancellationAction(requestId, note || undefined)
        toast.success("Solicitação recusada")
        setRejectMode(false)
        setNote("")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao recusar")
      }
    })
  }

  if (rejectMode) {
    return (
      <div className="flex flex-col gap-1 shrink-0">
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          disabled={pending}
          autoFocus
          className="text-[11px] border border-border rounded px-2 py-1 w-36 bg-background focus:outline-none focus:ring-1 focus:ring-destructive/50"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => { setRejectMode(false); setNote("") }}
            disabled={pending}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={pending}
            className="text-[10px] font-medium text-destructive hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending}
        title="Aprovar cancelamento"
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Aprovar
      </button>
      <button
        type="button"
        onClick={() => setRejectMode(true)}
        disabled={pending}
        title="Recusar cancelamento"
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
      >
        <X className="w-3 h-3" />
        Recusar
      </button>
    </div>
  )
}
