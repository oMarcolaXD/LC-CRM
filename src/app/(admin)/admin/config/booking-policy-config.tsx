"use client"

import { useFormStatus } from "react-dom"
import { Button }        from "@/components/ui/button"
import { Input }         from "@/components/ui/input"
import { Label }         from "@/components/ui/label"
import { Settings, Info, Loader2, CalendarClock, Ban, RefreshCw } from "lucide-react"
import { setBookingPolicyAction } from "@/lib/actions/config"

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending
        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        : <Settings className="w-4 h-4 mr-2" />
      }
      Salvar regras
    </Button>
  )
}

interface Props {
  maxDaysAhead:       number
  minHoursAhead:      number
  cancelMinHours:     number
  rescheduleMinHours: number
}

export function BookingPolicyForm({
  maxDaysAhead, minHoursAhead, cancelMinHours, rescheduleMinHours,
}: Props) {
  return (
    <form action={setBookingPolicyAction} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Máximo de dias à frente */}
        <div className="space-y-1.5">
          <Label htmlFor="booking_max_days_ahead" className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Antecedência máxima para agendar
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="booking_max_days_ahead"
              name="booking_max_days_ahead"
              type="number"
              min={1}
              max={365}
              defaultValue={maxDaysAhead}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">dias a partir de hoje</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Quantos dias à frente o responsável pode marcar uma aula.
          </p>
        </div>

        {/* Antecedência mínima para agendar */}
        <div className="space-y-1.5">
          <Label htmlFor="booking_min_hours_ahead" className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Antecedência mínima para agendar
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="booking_min_hours_ahead"
              name="booking_min_hours_ahead"
              type="number"
              min={0}
              max={720}
              defaultValue={minHoursAhead}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">horas antes</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Impede marcar aulas muito em cima da hora. Use <strong>0</strong> para sem limite.
          </p>
        </div>

        {/* Prazo para cancelar */}
        <div className="space-y-1.5">
          <Label htmlFor="cancel_min_hours" className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-primary" />
            Prazo mínimo para cancelar
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="cancel_min_hours"
              name="cancel_min_hours"
              type="number"
              min={0}
              max={720}
              defaultValue={cancelMinHours}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">horas antes da aula</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ex.: <strong>24</strong> = só cancela até 24h antes. Use <strong>0</strong> para sem limite.
          </p>
        </div>

        {/* Prazo para remarcar */}
        <div className="space-y-1.5">
          <Label htmlFor="reschedule_min_hours" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Prazo mínimo para remarcar
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="reschedule_min_hours"
              name="reschedule_min_hours"
              type="number"
              min={0}
              max={720}
              defaultValue={rescheduleMinHours}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">horas antes da aula</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ex.: <strong>24</strong> = só remarca até 24h antes. Use <strong>0</strong> para sem limite.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Estas regras valem para o <strong>painel do responsável</strong>. Colaboradores e
          administradores continuam podendo agendar, cancelar e remarcar sem restrição de prazo.
        </p>
      </div>

      <SaveButton />
    </form>
  )
}
