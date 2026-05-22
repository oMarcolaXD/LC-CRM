"use client"

import { useTransition }            from "react"
import { Button }                   from "@/components/ui/button"
import { updateLessonStatusAction } from "@/lib/actions/lesson-request"
import { sendConfirmationToGuardianAction } from "@/lib/actions/colaborador"
import { CheckCircle2, XCircle, UserX, MessageCircle, Loader2 } from "lucide-react"
import { toast }                    from "sonner"

interface LessonActionsProps {
  lessonId: string
  status:   "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED"
}

export function LessonActions({ lessonId, status }: LessonActionsProps) {
  const [pending, startTransition] = useTransition()

  const canAct = status === "SCHEDULED" || status === "CONFIRMED"

  async function handleStatus(next: "COMPLETED" | "CANCELLED" | "MISSED") {
    startTransition(async () => {
      try {
        await updateLessonStatusAction(lessonId, next)
        toast.success(
          next === "COMPLETED" ? "Aula marcada como realizada" :
          next === "CANCELLED" ? "Aula cancelada — saldo devolvido" :
          "Falta registrada"
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar aula")
      }
    })
  }

  async function handleWhatsApp() {
    startTransition(async () => {
      try {
        await sendConfirmationToGuardianAction(lessonId)
        toast.success("Confirmação enviada via WhatsApp")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar WhatsApp")
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {canAct && (
        <>
          <Button
            size="sm" variant="outline" disabled={pending}
            className="text-green-700 border-green-300 hover:bg-green-50 h-8 text-xs px-2"
            onClick={() => handleStatus("COMPLETED")}
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Realizada
          </Button>
          <Button
            size="sm" variant="outline" disabled={pending}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 text-xs px-2"
            onClick={() => handleStatus("CANCELLED")}
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
            Cancelar
          </Button>
          <Button
            size="sm" variant="outline" disabled={pending}
            className="text-orange-600 border-orange-300 hover:bg-orange-50 h-8 text-xs px-2"
            onClick={() => handleStatus("MISSED")}
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3 mr-1" />}
            Faltou
          </Button>
        </>
      )}
      <Button
        size="sm" variant="outline" disabled={pending}
        className="text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 h-8 text-xs px-2"
        onClick={handleWhatsApp}
      >
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3 mr-1" />}
        WhatsApp
      </Button>
    </div>
  )
}
