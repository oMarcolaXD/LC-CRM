"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cancelLessonDirectAction } from "@/lib/actions/lesson-cancellation"
import { Ban, Loader2 } from "lucide-react"

interface Props {
  lessonId: string
}

export function RequestCancellationButton({ lessonId }: Props) {
  const router  = useRouter()
  const [state, setState]   = useState<"idle" | "confirm">("idle")
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
        await cancelLessonDirectAction(lessonId, reason || undefined)
        toast.success("Aula cancelada")
        setState("idle")
        setReason("")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao cancelar aula")
        setState("idle")
      }
    })
  }

  if (state === "confirm") {
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
            Cancelar aula
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      title="Cancelar aula"
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
    >
      <Ban className="w-3 h-3" />
    </button>
  )
}
