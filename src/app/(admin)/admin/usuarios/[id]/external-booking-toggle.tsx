"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { setTeacherExternalBookingAction } from "../actions"
import { CalendarCheck, CalendarOff, Loader2 } from "lucide-react"
import { mensagemDeErro } from "@/lib/error-message"

interface Props {
  teacherId: string
  enabled:   boolean
}

export function ExternalBookingToggle({ teacherId, enabled }: Props) {
  const router = useRouter()
  const [on, setOn]     = useState(enabled)
  const [pending, start] = useTransition()

  function toggle(next: boolean) {
    setOn(next) // otimista
    start(async () => {
      try {
        await setTeacherExternalBookingAction(teacherId, next)
        toast.success(next
          ? "Professor habilitado para agendamentos externos"
          : "Professor removido dos agendamentos externos")
        router.refresh()
      } catch (e) {
        setOn(!next) // reverte
        toast.error(mensagemDeErro(e, "Erro ao atualizar"))
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3 min-w-0">
        {on
          ? <CalendarCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          : <CalendarOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {on ? "Disponível para agendamento externo" : "Fora do agendamento externo"}
          </p>
          <p className="text-xs text-muted-foreground">
            {on
              ? "Este professor aparece no autoatendimento do responsável e na API de horários."
              : "Responsáveis não conseguem agendar com este professor pelo autoatendimento."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <Switch checked={on} onCheckedChange={toggle} disabled={pending} />
      </div>
    </div>
  )
}
