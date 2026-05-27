"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteLessonAction } from "@/lib/actions/colaborador"
import { Trash2, Loader2 } from "lucide-react"

export function DeleteLessonButton({ lessonId }: { lessonId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          disabled={pending}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1 disabled:opacity-40"
        >
          Não
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              try {
                await deleteLessonAction(lessonId)
                router.refresh()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao excluir aula")
                setConfirm(false)
              }
            })
          }}
          className="text-[10px] font-medium text-destructive hover:underline disabled:opacity-50 flex items-center gap-1"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      disabled={pending}
      title="Excluir aula"
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="w-3 h-3" />
    </button>
  )
}
