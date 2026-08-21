"use client"

import { useTransition }            from "react"
import { Button }                   from "@/components/ui/button"
import { updateLessonStatusAction } from "@/lib/actions/lesson-request"
import { confirmLessonAction, sendConfirmationToGuardianAction } from "@/lib/actions/colaborador"
import { CheckCircle2, XCircle, UserX, MessageCircle, BellRing, Loader2 } from "lucide-react"
import { toast }                    from "sonner"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

interface LessonActionsProps {
  lessonId: string
  status:   "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED"
}

export function LessonActions({ lessonId, status }: LessonActionsProps) {
  const [pending, startTransition] = useTransition()

  const canAct = status === "SCHEDULED" || status === "CONFIRMED"

  async function handleConfirm() {
    startTransition(async () => {
      try {
        const { professor, responsaveis } = ouFalhe(await confirmLessonAction(lessonId))
        // A aula foi confirmada de todo jeito; o aviso é sobre quem não recebeu.
        const falhas = [
          responsaveis.problema ? `responsável: ${responsaveis.problema}` : null,
          professor.problema    ? `professor: ${professor.problema}`      : null,
        ].filter(Boolean)

        if (falhas.length > 0) toast.warning(`Aula confirmada, mas ${falhas.join(" · ")}`)
        else toast.success("Aula confirmada — professor e responsável notificados")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao confirmar a aula"))
      }
    })
  }

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
        toast.error(mensagemDeErro(e, "Erro ao atualizar aula"))
      }
    })
  }

  async function handleWhatsApp() {
    startTransition(async () => {
      try {
        const r = await sendConfirmationToGuardianAction(lessonId)
        // O envio pode não sair (sem telefone, API não configurada, erro da
        // Z-API). Nesse caso avisamos, em vez de dar um sucesso falso.
        if (r.problema) toast.warning(r.problema)
        else toast.success(`Confirmação enviada por ${r.canais.join(" e ")}`)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao enviar confirmação"))
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {status === "SCHEDULED" && (
        <Button
          size="sm" variant="outline" disabled={pending}
          className="text-brand-blue border-brand-blue/40 hover:bg-brand-blue/10 h-8 text-xs px-2"
          onClick={handleConfirm}
          title="Confirma a aula e notifica professor e responsável"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3 mr-1" />}
          Confirmar
        </Button>
      )}
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
