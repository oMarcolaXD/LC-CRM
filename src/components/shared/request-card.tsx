"use client"

import { useState, useTransition }  from "react"
import Link                          from "next/link"
import { Button }                    from "@/components/ui/button"
import { Badge }                     from "@/components/ui/badge"
import { Checkbox }                  from "@/components/ui/checkbox"
import { approveRequestAction, rejectRequestAction } from "@/lib/actions/lesson-request"
import { RescheduleDialog }          from "@/components/shared/reschedule-dialog"
import {
  CalendarDays, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Wifi, MapPin, Building2, Home, Users, ExternalLink, PackageX, Calendar, Repeat,
} from "lucide-react"
import { format, isToday, isTomorrow } from "date-fns"
import { ptBR }                      from "date-fns/locale"
import { toast }                     from "sonner"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

type TeacherMode = "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"

interface RequestCardProps {
  id:               string
  studentId?:       string
  studentName:      string
  teacherName:      string
  subjectName:      string
  preferredAt:      Date
  notes?:           string | null
  hasConflict?:     boolean
  outOfSchedule?:   boolean
  teacherMode:      TeacherMode
  requestModality:  "PRESENCIAL" | "ONLINE"
  isGroupRequest?:  boolean
  groupNote?:       string | null
  seriesIndex?:     number | null
  seriesTotal?:     number | null
  remainingLessons?: number | null
  packageExpired?:  boolean
  selectable?:      boolean
  selected?:        boolean
  onSelect?:        (id: string) => void
}

export function RequestCard({
  id, studentId, studentName, teacherName, subjectName,
  preferredAt, notes, hasConflict, outOfSchedule,
  teacherMode, requestModality, isGroupRequest, groupNote,
  seriesIndex, seriesTotal,
  remainingLessons, packageExpired,
  selectable, selected, onSelect,
}: RequestCardProps) {
  const isSeries = seriesTotal != null && seriesTotal > 1
  const [pending, startTransition]     = useTransition()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [modality, setModality]        = useState<"PRESENCIAL" | "ONLINE">(
    teacherMode === "ONLINE_ONLY" ? "ONLINE" : requestModality
  )
  const [teacherOnsite, setTeacherOnsite] = useState(false)

  const canSetPresencial   = teacherMode !== "ONLINE_ONLY"
  const showLocationToggle = modality === "ONLINE" && canSetPresencial

  const isUrgentToday     = isToday(preferredAt)
  const isUrgentTomorrow  = isTomorrow(preferredAt)
  const noPackage         = packageExpired === true
  const lowBalance        = !noPackage && remainingLessons != null && remainingLessons <= 2

  function handleApprove() {
    startTransition(async () => {
      try {
        const onsiteOverride = showLocationToggle ? teacherOnsite : undefined
        ouFalhe(await approveRequestAction(id, modality, onsiteOverride))
        toast.success(`Aula ${modality === "ONLINE" ? "online" : "presencial"} confirmada`)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao aprovar"))
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectRequestAction(id)
        toast.success("Solicitação recusada")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao recusar"))
      }
    })
  }

  return (
    <>
      <div className={`flex flex-col gap-3 p-4 rounded-xl border bg-card transition-colors ${
        hasConflict   ? "border-destructive/50 bg-destructive/5" :
        outOfSchedule ? "border-orange-300/60 bg-orange-50/50" :
        noPackage     ? "border-orange-400/50 bg-orange-50/30" :
        "border-border"
      }`}>

        {/* Alertas */}
        {(hasConflict || outOfSchedule || noPackage) && (
          <div className="flex flex-col gap-1">
            {hasConflict && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <strong>Conflito de horário:</strong>&nbsp;o professor já tem uma aula nesse horário.
              </div>
            )}
            {outOfSchedule && !hasConflict && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <strong>Fora da disponibilidade:</strong>&nbsp;o horário está fora da agenda do professor.
              </div>
            )}
            {noPackage && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg">
                <PackageX className="w-3.5 h-3.5 shrink-0" />
                <strong>Sem pacote ativo:</strong>&nbsp;o aluno não tem saldo de aulas disponível.
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Info */}
          <div className="flex gap-3 min-w-0">
            {selectable && (
              <div className="flex items-center pt-0.5">
                <Checkbox
                  checked={selected ?? false}
                  onCheckedChange={() => onSelect?.(id)}
                  disabled={pending}
                  aria-label={`Selecionar ${studentName}`}
                />
              </div>
            )}

            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {studentId ? (
                  <Link
                    href={`/colaborador/alunos/${studentId}`}
                    className="font-medium text-sm hover:underline inline-flex items-center gap-1"
                  >
                    {studentName}
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                  </Link>
                ) : (
                  <span className="font-medium text-sm">{studentName}</span>
                )}
                {isGroupRequest && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    <Users className="w-2.5 h-2.5" /> Grupo
                  </span>
                )}
                {isSeries && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary font-semibold">
                    <Repeat className="w-2.5 h-2.5" /> Série {seriesIndex}/{seriesTotal}
                  </span>
                )}
                {isUrgentToday && (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold uppercase tracking-wide">
                    Hoje
                  </span>
                )}
                {isUrgentTomorrow && !isUrgentToday && (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold uppercase tracking-wide">
                    Amanhã
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{subjectName} · Prof. {teacherName}</p>

              {/* Badge de pacote */}
              {noPackage ? null : (
                <p className={`text-xs mt-0.5 font-medium ${
                  lowBalance ? "text-amber-600" : "text-green-600"
                }`}>
                  {lowBalance
                    ? `⚠ ${remainingLessons} aula${remainingLessons === 1 ? "" : "s"} restante${remainingLessons === 1 ? "" : "s"}`
                    : `${remainingLessons} aulas restantes`
                  }
                </p>
              )}

              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {format(preferredAt, "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {requestModality === "ONLINE"
                  ? <><Wifi className="w-3 h-3 text-blue-500" /><span className="text-xs text-muted-foreground">Aluno quer: Online</span></>
                  : <><MapPin className="w-3 h-3 text-green-600" /><span className="text-xs text-muted-foreground">Aluno quer: Presencial</span></>
                }
              </div>
              {notes && (
                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                  &ldquo;{notes}&rdquo;
                </p>
              )}
              {isGroupRequest && groupNote && (
                <div className="flex items-start gap-1 mt-1 text-xs text-primary/80 bg-primary/5 px-2 py-1 rounded-md">
                  <Users className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{groupNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 shrink-0">
            {/* Toggle presencial / online */}
            {canSetPresencial ? (
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs self-end">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setModality("PRESENCIAL")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    modality === "PRESENCIAL"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <MapPin className="w-3 h-3" /> Presencial
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setModality("ONLINE")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    modality === "ONLINE"
                      ? "bg-brand-blue text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Wifi className="w-3 h-3" /> Online
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 self-end">
                <Wifi className="w-3 h-3" /> Apenas Online
              </div>
            )}

            {/* Toggle localização do professor */}
            {showLocationToggle && (
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs self-end">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setTeacherOnsite(false)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    !teacherOnsite
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Home className="w-3 h-3" /> Prof. em casa
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setTeacherOnsite(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    teacherOnsite
                      ? "bg-amber-100 text-amber-800 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Building2 className="w-3 h-3" /> Prof. na sede
                </button>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Pendente</Badge>
              <Button
                size="sm" variant="outline" disabled={pending}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleReject}
              >
                {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                Recusar
              </Button>
              <Button
                size="sm" variant="outline" disabled={pending}
                className="text-muted-foreground"
                onClick={() => setRescheduleOpen(true)}
                title="Aprovar com outro horário"
              >
                <Calendar className="w-3 h-3" />
              </Button>
              <Button
                size="sm" disabled={pending || noPackage}
                title={noPackage ? "Aluno sem pacote ativo" : undefined}
                onClick={handleApprove}
              >
                {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                Aprovar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        requestId={id}
        originalAt={preferredAt}
        teacherMode={teacherMode}
        requestModality={requestModality}
      />
    </>
  )
}
