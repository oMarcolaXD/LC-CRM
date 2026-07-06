"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast }     from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }    from "@/components/ui/button"
import { Ban, CalendarClock, Loader2, X } from "lucide-react"
import {
  guardianCancelLessonAction, guardianRescheduleLessonAction,
} from "@/lib/actions/guardian-lesson"
import { format } from "date-fns"
import { ptBR }   from "date-fns/locale"

interface Policy {
  cancelMinHours:     number
  rescheduleMinHours: number
  maxDaysAhead:       number
  minHoursAhead:      number
}

interface Props {
  lessonId:    string
  teacherId:   string
  teacherName: string
  subjectName: string
  scheduledAt: string   // ISO
  policy:      Policy
}

/** Horas restantes até o horário da aula. */
function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000)
}

export function LessonSelfActions({
  lessonId, teacherId, teacherName, subjectName, scheduledAt, policy,
}: Props) {
  const router = useRouter()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reason, setReason]   = useState("")
  const [showResched, setShowResched] = useState(false)
  const [pending, start]      = useTransition()

  const remaining   = hoursUntil(scheduledAt)
  const canCancel   = policy.cancelMinHours === 0     || remaining >= policy.cancelMinHours
  const canResched  = policy.rescheduleMinHours === 0 || remaining >= policy.rescheduleMinHours

  function doCancel() {
    start(async () => {
      try {
        await guardianCancelLessonAction(lessonId, reason || undefined)
        toast.success("Aula cancelada")
        setConfirmCancel(false)
        setReason("")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao cancelar aula")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
      {!confirmCancel ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline" size="sm"
            className="h-7 gap-1 text-xs"
            disabled={!canResched || pending}
            title={!canResched
              ? `Remarcação só até ${policy.rescheduleMinHours}h antes da aula`
              : "Remarcar aula"}
            onClick={() => setShowResched(true)}
          >
            <CalendarClock className="w-3.5 h-3.5" /> Remarcar
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-7 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            disabled={!canCancel || pending}
            title={!canCancel
              ? `Cancelamento só até ${policy.cancelMinHours}h antes da aula`
              : "Cancelar aula"}
            onClick={() => setConfirmCancel(true)}
          >
            <Ban className="w-3.5 h-3.5" /> Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 w-52">
          <textarea
            rows={2}
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            className="text-xs border border-border rounded p-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setConfirmCancel(false); setReason("") }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={doCancel}
              disabled={pending}
              className="text-xs font-medium text-destructive hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {pending && <Loader2 className="w-3 h-3 animate-spin" />}
              Confirmar cancelamento
            </button>
          </div>
        </div>
      )}

      {showResched && (
        <RescheduleDialog
          lessonId={lessonId}
          teacherId={teacherId}
          teacherName={teacherName}
          subjectName={subjectName}
          scheduledAt={scheduledAt}
          onClose={(changed) => { setShowResched(false); if (changed) router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── Dialog de remarcação ─────────────────────────────────────────────────────

interface DialogProps {
  lessonId:    string
  teacherId:   string
  teacherName: string
  subjectName: string
  scheduledAt: string
  onClose:     (changed: boolean) => void
}

function RescheduleDialog({
  lessonId, teacherId, teacherName, subjectName, scheduledAt, onClose,
}: DialogProps) {
  const [dates, setDates]     = useState<string[]>([])
  const [slots, setSlots]     = useState<string[]>([])
  const [date, setDate]       = useState("")
  const [slot, setSlot]       = useState("")
  const [loadingDates, setLoadingDates] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [pending, start]      = useTransition()

  // Carrega datas disponíveis do professor
  useEffect(() => {
    setLoadingDates(true)
    fetch(`/api/teachers/${teacherId}/slots`)
      .then((r) => r.json())
      .then((d) => setDates(d.dates ?? []))
      .finally(() => setLoadingDates(false))
  }, [teacherId])

  // Carrega horários quando a data muda
  useEffect(() => {
    if (!date) { setSlots([]); setSlot(""); return }
    setLoadingSlots(true)
    fetch(`/api/teachers/${teacherId}/slots?date=${date}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots ?? []); setSlot("") })
      .finally(() => setLoadingSlots(false))
  }, [teacherId, date])

  function submit() {
    if (!date || !slot) { toast.error("Escolha uma nova data e horário"); return }
    start(async () => {
      try {
        await guardianRescheduleLessonAction(lessonId, date, slot)
        toast.success("Aula remarcada")
        onClose(true)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao remarcar aula")
      }
    })
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(false) }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-sub text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Remarcar aula
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">{subjectName}</strong> · Prof. {teacherName}</p>
            <p className="mt-0.5">
              Atual: {format(new Date(scheduledAt), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Datas */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Nova data</p>
            {loadingDates ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando disponibilidade…
              </div>
            ) : dates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma data disponível para este professor.</p>
            ) : (
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione a data</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {format(new Date(d + "T00:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Horários */}
          {date && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Novo horário</p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando horários…
                </div>
              ) : slots.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem horários livres nesta data. Escolha outro dia.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        slot === s
                          ? "bg-primary text-white border-primary"
                          : "border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onClose(false)} disabled={pending}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={pending || !date || !slot}>
            {pending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Confirmar remarcação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
