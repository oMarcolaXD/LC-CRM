"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { requestLessonCancellationAction } from "@/lib/actions/lesson-cancellation"
import { Ban, Loader2, Clock } from "lucide-react"

interface Props {
  lessonId:          string
  hasPendingRequest: boolean
}

export function RequestCancellationButton({ lessonId, hasPendingRequest }: Props) {
  const router  = useRouter()
  const [state, setState]   = useState<"idle" | "confirm" | "sending" | "sent">(
    hasPendingRequest ? "sent" : "idle"
  )
  const [reason, setReason] = useState("")
  const [pending, start]    = useTransition()
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

  function handleConfirm() {
    setState("confirm")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleSubmit() {
    start(async () => {
      try {
        await requestLessonCancellationAction(lessonId, reason || undefined)
        setState("sent")
        toast.success("Solicitação enviada ao admin")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar solicitação")
        setState("idle")
      }
    })
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
        <Clock className="w-2.5 h-2.5" />
        Aguardando admin
      </span>
    )
  }

  if (state === "confirm" || state === "sending") {
    return (
      <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <textarea
          ref={textareaRef}
          rows={2}
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={pending}
          className="text-[10px] border border-border rounded p-1 w-44 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setState("idle"); setReason("") }}
            disabled={pending}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Não
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="text-[10px] font-medium text-destructive hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            {pending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
            Solicitar
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      title="Solicitar cancelamento ao admin"
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
    >
      <Ban className="w-3 h-3" />
    </button>
  )
}
