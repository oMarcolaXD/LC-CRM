"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import {
  addDays, addMonths, format, isToday, parseISO, getDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth,
} from "date-fns"
import { ptBR }                    from "date-fns/locale"
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange, LayoutGrid,
  CheckCircle2, XCircle, UserX, MessageCircle,
  Loader2, Wifi, MapPin, Clock, Plus, Building2, Home, AlertCircle, Users,
} from "lucide-react"
import { Button }                  from "@/components/ui/button"
import {
  updateLessonStatusAction,
  createLessonDirectAction,
  approveRequestAction,
  rejectRequestAction,
} from "@/lib/actions/lesson-request"
import { sendLessonWhatsAppAction } from "@/lib/actions/colaborador"
import { toast }                   from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { CreateGroupLessonDialog } from "@/components/shared/create-group-lesson-dialog"

// ─── Constantes de layout ────────────────────────────────────────────────────

const HOUR_H = 72
const COL_W  = 160
const TIME_W = 52
const START  = 7
const END    = 21
const TOTAL  = END - START

const px = (min: number) => (min / 60) * HOUR_H

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ViewMode = "day" | "week" | "month"

const DOW_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
type LessonStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED"

const STATUS_STYLE: Record<LessonStatus, { bg: string; text: string; border: string }> = {
  SCHEDULED: { bg: "bg-amber-400",  text: "text-amber-900", border: "border-amber-500/80" },
  CONFIRMED: { bg: "bg-[#219EBC]",  text: "text-white",     border: "border-[#1a7e96]"   },
  COMPLETED: { bg: "bg-slate-400",  text: "text-white",     border: "border-slate-500"   },
  CANCELLED: { bg: "bg-rose-400",   text: "text-white",     border: "border-rose-500"    },
  MISSED:    { bg: "bg-orange-400", text: "text-white",     border: "border-orange-500"  },
}

const STATUS_LABEL: Record<LessonStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  MISSED:    "Faltou",
}

export interface AvailSlot    { start: number; end: number }
export interface StudentOption { id: string; name: string; remainingLessons: number }
export interface SubjectOption { id: string; name: string }

export interface TeacherCol {
  id:              string
  name:            string
  teachingMode:    "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  slots:           AvailSlot[]
  rawAvailability: Record<string, { start: string; end: string }[]>
  subjects?:       SubjectOption[]
}

export interface LessonSlot {
  id:            string
  teacherId:     string
  startMin:      number
  duration:      number
  status:        LessonStatus
  modality:      "PRESENCIAL" | "ONLINE"
  teacherOnsite: boolean
  time:          string
  studentName:   string
  subjectName:   string
  guardianName:  string | null
}

export interface WeekLessonSlot extends LessonSlot {
  date: string // "yyyy-MM-dd"
}

export interface PendingRequestSlot {
  id:          string
  teacherId:   string
  startMin:    number
  time:        string
  date:        string  // "yyyy-MM-dd"
  studentName: string
  subjectName: string
  modality:    "PRESENCIAL" | "ONLINE"
  teacherMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  notes:       string | null
}

// ─── Modal: detalhes de aula ─────────────────────────────────────────────────

function LessonDetailModal({
  lesson,
  teacherName,
  onClose,
}: {
  lesson:      LessonSlot
  teacherName: string
  onClose:     () => void
}) {
  const [completing,    setCompleting]    = useState(false)
  const [topicsCovered, setTopicsCovered] = useState("")
  const [teacherNotes,  setTeacherNotes]  = useState("")
  const [pending, start] = useTransition()

  const canAct = lesson.status === "SCHEDULED" || lesson.status === "CONFIRMED"
  const { bg, text } = STATUS_STYLE[lesson.status]

  const act = (next: "COMPLETED" | "CANCELLED" | "MISSED") =>
    start(async () => {
      try {
        await updateLessonStatusAction(
          lesson.id, next,
          next === "COMPLETED" ? topicsCovered : undefined,
          next === "COMPLETED" ? teacherNotes  : undefined,
        )
        toast.success(
          next === "COMPLETED" ? "Aula concluída" :
          next === "CANCELLED" ? "Aula cancelada" : "Falta registrada"
        )
        onClose()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro")
      }
    })

  const whatsapp = () =>
    start(async () => {
      try {
        await sendLessonWhatsAppAction(lesson.id)
        toast.success("WhatsApp enviado")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro")
      }
    })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>Detalhes da Aula</DialogTitle>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${bg} ${text}`}>
              {STATUS_LABEL[lesson.status]}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Aluno</p>
              <p className="font-medium">{lesson.studentName}</p>
              {lesson.guardianName && (
                <p className="text-[11px] text-muted-foreground">↳ {lesson.guardianName}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Matéria</p>
              <p className="font-medium">{lesson.subjectName}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Professor</p>
              <p className="font-medium">{teacherName}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Horário</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lesson.time} · {lesson.duration}min
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Modalidade</p>
              {lesson.modality === "ONLINE" ? (
                <div>
                  <p className="font-medium flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Online
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    {lesson.teacherOnsite
                      ? <><Building2 className="w-3 h-3 text-amber-500" /> Professor na sede</>
                      : <><Home className="w-3 h-3 text-blue-400" /> Professor em casa</>
                    }
                  </p>
                </div>
              ) : (
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Presencial
                </p>
              )}
            </div>
          </div>

          {(canAct || true) && <hr className="border-border" />}

          {canAct && completing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">
                  Tópicos cobertos <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={topicsCovered}
                  onChange={e => setTopicsCovered(e.target.value)}
                  placeholder="Ex: Equações do 2º grau, fórmula de Bhaskara..."
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notas do professor</label>
                <textarea
                  value={teacherNotes}
                  onChange={e => setTeacherNotes(e.target.value)}
                  placeholder="Observações internas..."
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCompleting(false)} disabled={pending}>
                  Voltar
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => act("COMPLETED")}
                  disabled={pending || !topicsCovered.trim()}
                >
                  {pending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  }
                  Salvar e concluir
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canAct && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setCompleting(true)}
                    disabled={pending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Concluída
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act("CANCELLED")} disabled={pending}>
                    {pending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      : <XCircle className="w-3.5 h-3.5 mr-1" />
                    }
                    Cancelar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act("MISSED")} disabled={pending}>
                    {pending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      : <UserX className="w-3.5 h-3.5 mr-1" />
                    }
                    Faltou
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={whatsapp} disabled={pending}>
                {pending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  : <MessageCircle className="w-3.5 h-3.5 mr-1" />
                }
                WhatsApp
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal: agendar aula rápida ───────────────────────────────────────────────

function QuickScheduleModal({
  schedule,
  date,
  students,
  teachers,
  onClose,
}: {
  schedule: { teacherId: string; teacherName: string; time: string }
  date:     string
  students: StudentOption[]
  teachers: TeacherCol[]
  onClose:  () => void
}) {
  const teacher      = teachers.find(t => t.id === schedule.teacherId)
  const scheduledAt  = new Date(`${date}T${schedule.time}:00`)
  const isHistorical = scheduledAt < new Date()

  const isOnlineOnly = teacher?.teachingMode === "ONLINE_ONLY"

  const [studentId,    setStudentId]    = useState("")
  const [subjectId,    setSubjectId]    = useState("")
  const [modality,     setModality]     = useState<"PRESENCIAL" | "ONLINE">(isOnlineOnly ? "ONLINE" : "PRESENCIAL")
  const [teacherOnsite, setTeacherOnsite] = useState(false)
  const [pending, start] = useTransition()

  const showLocationToggle = modality === "ONLINE" && !isOnlineOnly

  const submit = () =>
    start(async () => {
      if (!studentId || !subjectId) {
        toast.error("Preencha todos os campos obrigatórios")
        return
      }
      try {
        await createLessonDirectAction({
          teacherId: schedule.teacherId,
          studentId,
          subjectId,
          date,
          time: schedule.time,
          modality,
          teacherOnsite: modality === "ONLINE" ? teacherOnsite : undefined,
        })
        toast.success(isHistorical ? "Histórico importado" : "Aula agendada com sucesso")
        onClose()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao agendar")
      }
    })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHistorical
              ? <Clock className="w-4 h-4 text-amber-500" />
              : <Plus className="w-4 h-4 text-primary" />
            }
            {isHistorical ? "Importar Histórico" : "Agendar Aula"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isHistorical && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Data no passado — será registrada como <strong>importação de histórico</strong> com status <strong>Realizada</strong>. Sem notificações.
              </span>
            </div>
          )}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Professor · Horário</p>
            <p className="font-semibold">{schedule.teacherName}</p>
            <p className="text-muted-foreground text-xs">
              {schedule.time} · {format(parseISO(date), "dd/MM/yyyy")}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">
              Aluno <span className="text-destructive">*</span>
            </label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecionar aluno...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.remainingLessons} aula{s.remainingLessons !== 1 ? "s" : ""} restante{s.remainingLessons !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium">
              Matéria <span className="text-destructive">*</span>
            </label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={!teacher?.subjects?.length}
            >
              <option value="">Selecionar matéria...</option>
              {(teacher?.subjects ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium">Modalidade</label>
            {isOnlineOnly ? (
              <div className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <Wifi className="w-3.5 h-3.5" /> Online (professor só atende remotamente)
              </div>
            ) : (
              <div className="mt-1 flex rounded-lg border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => setModality("PRESENCIAL")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "PRESENCIAL"
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setModality("ONLINE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "ONLINE"
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  Online
                </button>
              </div>
            )}
          </div>

          {/* Localização do professor — apenas para online com professor não-ONLINE_ONLY */}
          {showLocationToggle && (
            <div>
              <label className="text-xs font-medium">Local do professor</label>
              <div className="mt-1 flex rounded-lg border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTeacherOnsite(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    !teacherOnsite
                      ? "bg-muted text-foreground font-medium"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Em casa
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherOnsite(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    teacherOnsite
                      ? "bg-amber-100 text-amber-800 font-medium"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Na sede
                </button>
              </div>
              {teacherOnsite && (
                <p className="text-[10px] text-muted-foreground mt-1">Ocupará uma sala na sede.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending || !studentId || !subjectId}>
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bloco de aula dentro do grid ────────────────────────────────────────────

function LessonBlock({
  lesson,
  onSelect,
}: {
  lesson:   LessonSlot
  onSelect: (l: LessonSlot) => void
}) {
  const { bg, text, border } = STATUS_STYLE[lesson.status]
  const height = Math.max(px(lesson.duration), 32)

  return (
    <div
      data-lesson="true"
      onClick={() => onSelect(lesson)}
      style={{ top: px(lesson.startMin - START * 60), height, left: 3, right: 3 }}
      className={`absolute rounded-lg border overflow-hidden select-none cursor-pointer transition-opacity hover:opacity-85 active:opacity-70 ${bg} ${text} ${border}`}
    >
      <div className="px-1.5 pt-1 pb-0.5">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-bold leading-tight">{lesson.time}</p>
          {lesson.modality === "ONLINE" ? (
            <>
              <Wifi className="w-2.5 h-2.5 opacity-80 shrink-0" />
              {lesson.teacherOnsite && (
                <Building2 className="w-2.5 h-2.5 opacity-90 shrink-0" />
              )}
            </>
          ) : (
            <MapPin className="w-2.5 h-2.5 opacity-80 shrink-0" />
          )}
        </div>
        <p className="text-[12px] font-semibold leading-tight truncate">
          {lesson.studentName.split(" ")[0]}
          {lesson.studentName.split(" ").length > 1 && (
            <span className="opacity-80"> {lesson.studentName.split(" ")[1]?.[0]}.</span>
          )}
        </p>
        {height >= 52 && (
          <p className="text-[10px] leading-tight truncate opacity-85">{lesson.subjectName}</p>
        )}
        {height >= 68 && lesson.guardianName && (
          <p className="text-[10px] leading-tight truncate opacity-70">
            ↳ {lesson.guardianName.split(" ")[0]}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Modal: aprovar / recusar solicitação pendente ───────────────────────────

function PendingApprovalModal({
  req,
  teacherName,
  lessons,
  onClose,
}: {
  req:         PendingRequestSlot
  teacherName: string
  lessons:     LessonSlot[]
  onClose:     () => void
}) {
  const [modality,      setModality]      = useState<"PRESENCIAL" | "ONLINE">(
    req.teacherMode === "ONLINE_ONLY" ? "ONLINE" : req.modality
  )
  const [teacherOnsite, setTeacherOnsite] = useState(false)
  const [pending, start] = useTransition()

  const canSetPresencial   = req.teacherMode !== "ONLINE_ONLY"
  const showLocationToggle = modality === "ONLINE" && canSetPresencial

  const hasConflict = lessons.some(l => {
    if (l.teacherId !== req.teacherId) return false
    if (l.status === "CANCELLED" || l.status === "MISSED") return false
    return l.startMin < req.startMin + 60 && l.startMin + l.duration > req.startMin
  })

  const approve = () => start(async () => {
    try {
      await approveRequestAction(req.id, modality, showLocationToggle ? teacherOnsite : undefined)
      toast.success(`Aula ${modality === "ONLINE" ? "online" : "presencial"} confirmada`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar")
    }
  })

  const reject = () => start(async () => {
    try {
      await rejectRequestAction(req.id)
      toast.success("Solicitação recusada")
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao recusar")
    }
  })

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>Solicitação Pendente</DialogTitle>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              Aguardando aprovação
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {hasConflict && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span><strong>Conflito:</strong> o professor já tem uma aula confirmada neste horário.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm rounded-lg bg-muted/40 px-4 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Aluno</p>
              <p className="font-medium">{req.studentName}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Matéria</p>
              <p className="font-medium">{req.subjectName}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Professor</p>
              <p className="font-medium">{teacherName}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Horário solicitado</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> {req.time}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pedido pelo aluno</p>
              <p className="font-medium flex items-center gap-1">
                {req.modality === "ONLINE"
                  ? <><Wifi    className="w-3 h-3 text-blue-500"  /> Online</>
                  : <><MapPin  className="w-3 h-3 text-green-600" /> Presencial</>
                }
              </p>
            </div>
          </div>

          {req.notes && (
            <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg italic">
              &ldquo;{req.notes}&rdquo;
            </p>
          )}

          <hr className="border-border" />

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmar modalidade</p>

            {canSetPresencial ? (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button type="button" onClick={() => setModality("PRESENCIAL")} disabled={pending}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors ${
                    modality === "PRESENCIAL" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
                <button type="button" onClick={() => setModality("ONLINE")} disabled={pending}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors ${
                    modality === "ONLINE" ? "bg-brand-blue text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" /> Online
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <Wifi className="w-4 h-4" /> Online (professor só atende remotamente)
              </div>
            )}

            {showLocationToggle && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Local do professor na aula online</p>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button type="button" onClick={() => setTeacherOnsite(false)} disabled={pending}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                      !teacherOnsite ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" /> Em casa
                  </button>
                  <button type="button" onClick={() => setTeacherOnsite(true)} disabled={pending}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                      teacherOnsite ? "bg-amber-100 text-amber-800 font-medium" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Na sede
                  </button>
                </div>
                {teacherOnsite && (
                  <p className="text-[10px] text-muted-foreground">Ocupará uma sala na sede.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline"
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={reject} disabled={pending}
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
              Recusar
            </Button>
            <Button className="flex-1" onClick={approve} disabled={pending}>
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              Aprovar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bloco de solicitação pendente na grade ───────────────────────────────────

function PendingBlock({
  req,
  onSelect,
}: {
  req:      PendingRequestSlot
  onSelect: (r: PendingRequestSlot) => void
}) {
  const height = Math.max(px(60), 40)
  return (
    <div
      data-lesson="true"
      onClick={() => onSelect(req)}
      style={{ top: px(req.startMin - START * 60), height, left: 3, right: 3 }}
      className="absolute rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 text-orange-900 overflow-hidden select-none cursor-pointer transition-all hover:bg-orange-100 hover:border-orange-500 active:opacity-70 z-10"
    >
      <div className="px-1.5 pt-1 pb-0.5">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-bold leading-tight">{req.time}</p>
          <AlertCircle className="w-2.5 h-2.5 shrink-0 opacity-70" />
        </div>
        <p className="text-[12px] font-semibold leading-tight truncate">
          {req.studentName.split(" ")[0]}
          {req.studentName.split(" ").length > 1 && (
            <span className="opacity-75"> {req.studentName.split(" ")[1]?.[0]}.</span>
          )}
        </p>
        {height >= 52 && (
          <p className="text-[10px] leading-tight truncate opacity-80">{req.subjectName}</p>
        )}
        <p className="text-[8px] font-bold uppercase tracking-wider opacity-50 mt-0.5">Pendente</p>
      </div>
    </div>
  )
}

// ─── Recalcula slots de disponibilidade pelo dia da semana ───────────────────

function computeSlots(
  raw: Record<string, { start: string; end: string }[]>,
  dow: number,
): AvailSlot[] {
  return (raw[String(dow)] ?? []).map(s => {
    const [sh, sm] = s.start.split(":").map(Number)
    const [eh, em] = s.end.split(":").map(Number)
    return { start: sh * 60 + sm, end: eh * 60 + em }
  })
}

// ─── Grade principal ──────────────────────────────────────────────────────────

interface AgendaGridProps {
  date:                  string
  teachers:              TeacherCol[]
  lessons:               LessonSlot[]
  roomCount?:            number
  students?:             StudentOption[]
  allStudents?:          { id: string; name: string }[]
  weekLessons?:          WeekLessonSlot[]
  monthLessons?:         WeekLessonSlot[]
  initialView?:          ViewMode
  pendingRequests?:      PendingRequestSlot[]
  weekPendingRequests?:  PendingRequestSlot[]
}

export function AgendaGrid({
  date, teachers, lessons: initialLessons, roomCount = 3, students, allStudents,
  weekLessons: initialWeekLessons, monthLessons: initialMonthLessons, initialView = "day",
  pendingRequests: initialPending, weekPendingRequests: initialWeekPending,
}: AgendaGridProps) {
  // ── Data state (managed client-side after initial SSR) ────────────────────

  const [curDate, setCurDate]       = useState(date)
  const [isLoading, setIsLoading]   = useState(false)
  const [lessons, setLessons]       = useState(initialLessons)
  const [weekLessons, setWeekLessons]   = useState(initialWeekLessons ?? [])
  const [monthLessons, setMonthLessons] = useState(initialMonthLessons ?? [])
  const [pendingRequests,     setPendingRequests]     = useState<PendingRequestSlot[]>(initialPending ?? [])
  const [weekPendingRequests, setWeekPendingRequests] = useState<PendingRequestSlot[]>(initialWeekPending ?? [])
  const abortRef   = useRef<AbortController | null>(null)
  const hasMounted = useRef(false)

  const parsed = parseISO(curDate)
  const today  = isToday(parsed)

  // Recalcula disponibilidade dos professores conforme o dia navegado
  const effectiveTeachers = teachers.map(t => ({
    ...t,
    slots: computeSlots(t.rawAvailability, getDay(parsed)),
  }))

  const [view, setView]                     = useState<ViewMode>(initialView)
  const [selectedLesson,  setSelectedLesson]  = useState<LessonSlot | null>(null)
  const [selectedPending, setSelectedPending] = useState<PendingRequestSlot | null>(null)
  const [quickSchedule,  setQuickSchedule]  = useState<{
    teacherId:   string
    teacherName: string
    time:        string
  } | null>(null)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{
    teacherId: string
    timeMin:   number
  } | null>(null)

  // ── Client-side fetch ─────────────────────────────────────────────────────

  const fetchData = async (d: string, v: ViewMode) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsLoading(true)
    try {
      const res  = await fetch(`/api/colaborador/agenda?date=${d}&view=${v}`, { signal: ctrl.signal })
      if (!res.ok) return
      const data = await res.json()
      setLessons(data.lessons)
      setWeekLessons(v === "week"  ? data.extraLessons : [])
      setMonthLessons(v === "month" ? data.extraLessons : [])
      setPendingRequests(data.pendingRequests ?? [])
      setWeekPendingRequests(v !== "day" ? (data.weekPendingRequests ?? []) : [])
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("agenda fetch error", e)
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false)
    }
  }

  // Fetch whenever curDate or view changes (skip the initial render)
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return }
    fetchData(curDate, view)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curDate, view])

  // Sync state when browser back/forward buttons are used
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search)
      const d  = sp.get("date") ?? format(new Date(), "yyyy-MM-dd")
      const v  = (sp.get("view") ?? "day") as ViewMode
      setCurDate(d)
      setView(v)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // ── Navigation (URL via history API — no full page reload) ────────────────

  const pushUrl = (d: string, v: ViewMode) => {
    const url = new URL(window.location.href)
    url.searchParams.set("date", d)
    if (v !== "day") url.searchParams.set("view", v)
    else url.searchParams.delete("view")
    window.history.pushState({}, "", url.toString())
  }

  const navigate = (delta: number) => {
    const cur     = parseISO(curDate)
    const newDate =
      view === "month" ? format(addMonths(cur, delta), "yyyy-MM-dd") :
      view === "week"  ? format(addDays(cur, delta * 7), "yyyy-MM-dd") :
                         format(addDays(cur, delta), "yyyy-MM-dd")
    setCurDate(newDate)
    pushUrl(newDate, view)
  }

  const switchView = (v: ViewMode) => {
    setView(v)
    setHoveredCell(null)
    pushUrl(curDate, v)
  }

  const goToday = () => {
    const d = format(new Date(), "yyyy-MM-dd")
    setCurDate(d)
    pushUrl(d, view)
  }

  // ── Day view helpers ──────────────────────────────────────────────────────

  const now    = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowTop = today && nowMin >= START * 60 && nowMin <= END * 60
    ? px(nowMin - START * 60)
    : null

  const hours     = Array.from({ length: TOTAL }, (_, i) => START + i)
  const byTeacher = (id: string) => lessons.filter(l => l.teacherId === id)

  const roomUsage = (hour: number): number => {
    const slotStart = hour * 60
    const slotEnd   = slotStart + 60
    return lessons.filter(l => {
      if (l.modality !== "PRESENCIAL") return false
      if (l.status === "CANCELLED" || l.status === "MISSED") return false
      const lEnd = l.startMin + l.duration
      return l.startMin < slotEnd && lEnd > slotStart
    }).length
  }

  const handleMouseMove = (t: TeacherCol, e: React.MouseEvent<HTMLDivElement>) => {
    if (!students?.length || !t.slots.length) {
      setHoveredCell(null)
      return
    }
    if ((e.target as HTMLElement).closest("[data-lesson]")) {
      setHoveredCell(null)
      return
    }
    const rect    = e.currentTarget.getBoundingClientRect()
    const y       = e.clientY - rect.top
    const snapped = Math.floor((START * 60 + (y / HOUR_H) * 60) / 30) * 30

    if (snapped < START * 60 || snapped + 60 > END * 60) {
      setHoveredCell(null)
      return
    }

    const avail = t.slots.some(s => snapped >= s.start && snapped + 60 <= s.end)
    const taken = byTeacher(t.id).some(
      l => snapped < l.startMin + l.duration && snapped + 60 > l.startMin
    )
    setHoveredCell(avail && !taken ? { teacherId: t.id, timeMin: snapped } : null)
  }

  const handleColumnClick = (t: TeacherCol, e: React.MouseEvent<HTMLDivElement>) => {
    if (!students?.length) return
    if ((e.target as HTMLElement).closest("[data-lesson]")) return
    if (!t.slots.length) return

    const rect       = e.currentTarget.getBoundingClientRect()
    const y          = e.clientY - rect.top
    const totalMin   = Math.floor((START * 60 + (y / HOUR_H) * 60) / 30) * 30
    const isAvailable = t.slots.some(s => totalMin >= s.start && totalMin + 60 <= s.end)
    if (!isAvailable) return

    const hasLesson = byTeacher(t.id).some(
      l => totalMin >= l.startMin && totalMin < l.startMin + l.duration
    )
    if (hasLesson) return

    const time = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`
    setQuickSchedule({ teacherId: t.id, teacherName: t.name, time })
  }

  // ── Week view helpers ─────────────────────────────────────────────────────

  const weekStart = startOfWeek(parsed, { weekStartsOn: 1 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const weekLabel = (() => {
    const from = format(weekStart, "dd/MM", { locale: ptBR })
    const to   = format(addDays(weekStart, 6), "dd/MM/yyyy", { locale: ptBR })
    return `${from} – ${to}`
  })()

  // ── Month view helpers ────────────────────────────────────────────────────

  const monthStart  = startOfMonth(parsed)
  const monthEnd    = endOfMonth(parsed)
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd      = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const calDays     = eachDayOfInterval({ start: calStart, end: calEnd })
  const calWeeks    = Array.from(
    { length: Math.ceil(calDays.length / 7) },
    (_, i) => calDays.slice(i * 7, i * 7 + 7)
  )
  const lessonsByDay = (monthLessons ?? []).reduce<Record<string, WeekLessonSlot[]>>((acc, l) => {
    ;(acc[l.date] ??= []).push(l)
    return acc
  }, {})
  const monthLabel = format(parsed, "MMMM 'de' yyyy", { locale: ptBR })

  const totalW = TIME_W + effectiveTeachers.length * COL_W

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col relative">
        {/* Barra de progresso durante fetch */}
        {isLoading && (
          <div className="absolute inset-x-0 top-0 h-0.5 z-50 bg-border overflow-hidden">
            <div className="h-full bg-primary w-1/2 animate-pulse rounded-full" />
          </div>
        )}

        {/* ── Barra de navegação ────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0 flex-wrap gap-y-2">

          {/* Esquerda: setas + hoje + toggle de visualização */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="h-7 w-7 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(1)} className="h-7 w-7 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
              {(!today || view !== "day") && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={goToday}>
                  Hoje
                </Button>
              )}
            </div>

            {/* Toggle Dia / Semana / Mês */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden h-7">
              {(["day", "week", "month"] as ViewMode[]).map((v, i) => {
                const Icon  = v === "day" ? CalendarDays : v === "week" ? CalendarRange : LayoutGrid
                const label = v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"
                return (
                  <button
                    key={v}
                    onClick={() => switchView(v)}
                    className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                      view === v
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted/50 bg-background"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Centro: data */}
          <div className="flex items-center gap-2">
            {view === "month" ? (
              <p className="text-sm font-semibold capitalize">{monthLabel}</p>
            ) : view === "week" ? (
              <p className="text-sm font-semibold">{weekLabel}</p>
            ) : (
              <>
                <CalendarDays className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold capitalize">
                  {format(parsed, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                {today && (
                  <span className="text-[11px] bg-primary text-white px-2 py-0.5 rounded-full font-medium">Hoje</span>
                )}
              </>
            )}
          </div>

          {/* Direita: contagem + legenda + botão grupo */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {allStudents && allStudents.length >= 2 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setShowGroupDialog(true)}
              >
                <Users className="w-3.5 h-3.5" />
                Grupo
              </Button>
            )}
            <span>
              {view === "month"
                ? `${(monthLessons ?? []).length} aula${(monthLessons ?? []).length !== 1 ? "s" : ""} no mês`
                : view === "week"
                ? `${(weekLessons ?? []).length} aula${(weekLessons ?? []).length !== 1 ? "s" : ""} na semana`
                : `${lessons.length} aula${lessons.length !== 1 ? "s" : ""}`
              }
            </span>
            <div className="hidden sm:flex items-center gap-2">
              {(["CONFIRMED", "SCHEDULED", "COMPLETED"] as LessonStatus[]).map(s => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_STYLE[s].bg}`} />
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── VISUALIZAÇÃO: MÊS ───────────────────────────── */}
        {view === "month" && (
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>

            {/* Cabeçalho dos dias da semana */}
            <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-background/95 backdrop-blur-sm">
              {DOW_LABELS.map(label => (
                <div key={label} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {label}
                </div>
              ))}
            </div>

            {/* Semanas */}
            {calWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-border/50 last:border-b-0">
                {week.map(day => {
                  const dayStr       = format(day, "yyyy-MM-dd")
                  const inMonth      = isSameMonth(day, parsed)
                  const isCurrentDay = isToday(day)
                  const isSelected   = dayStr === date
                  const dayLessons   = (lessonsByDay[dayStr] ?? []).sort((a, b) => a.startMin - b.startMin)
                  const dayPending   = weekPendingRequests.filter(r => r.date === dayStr)
                  const visible      = dayLessons.slice(0, dayPending.length > 0 ? 2 : 3)
                  const overflow     = dayLessons.length - visible.length

                  const goDay = () => { setCurDate(dayStr); setView("day"); pushUrl(dayStr, "day") }

                  return (
                    <div
                      key={dayStr}
                      onClick={goDay}
                      className={`min-h-28 border-r border-border/50 last:border-r-0 flex flex-col transition-colors cursor-pointer hover:bg-muted/30 ${
                        inMonth ? "bg-card" : "bg-muted/20"
                      } ${isSelected && !isCurrentDay ? "ring-1 ring-inset ring-primary/30" : ""}`}
                    >
                      {/* Número do dia */}
                      <div className="flex items-center justify-between px-1.5 pt-1.5 pb-1">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrentDay
                            ? "bg-primary text-white"
                            : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                        }`}>
                          {format(day, "d")}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {dayLessons.length > 0 && (
                            <span className={`text-[9px] font-medium px-1 rounded ${
                              inMonth ? "text-primary/70" : "text-muted-foreground/40"
                            }`}>
                              {dayLessons.length}
                            </span>
                          )}
                          {dayPending.length > 0 && inMonth && (
                            <span className="text-[9px] font-semibold px-1 rounded bg-orange-100 text-orange-600">
                              !{dayPending.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pills de aula */}
                      <div className="flex-1 px-1 pb-1.5 space-y-0.5">
                        {visible.map(lesson => {
                          const { bg, text: txtCls } = STATUS_STYLE[lesson.status]
                          return (
                            <button
                              key={lesson.id}
                              className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${bg} ${txtCls} ${!inMonth ? "opacity-40" : ""}`}
                              onClick={e => { e.stopPropagation(); setSelectedLesson(lesson) }}
                            >
                              {lesson.time} {lesson.studentName.split(" ")[0]}
                            </button>
                          )
                        })}
                        {dayPending.slice(0, 1).map(req => (
                          <button
                            key={req.id}
                            className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border border-dashed border-orange-400 bg-orange-50 text-orange-800 transition-opacity hover:opacity-80 ${!inMonth ? "opacity-40" : ""}`}
                            onClick={e => { e.stopPropagation(); setSelectedPending(req) }}
                          >
                            ⏳ {req.time} {req.studentName.split(" ")[0]}
                          </button>
                        ))}
                        {overflow > 0 && (
                          <button
                            className="w-full text-left text-[10px] text-muted-foreground px-1.5 py-0.5 hover:bg-muted/50 rounded transition-colors"
                            onClick={e => { e.stopPropagation(); goDay() }}
                          >
                            +{overflow + dayPending.slice(1).length} mais
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── VISUALIZAÇÃO: SEMANA ─────────────────────────── */}
        {view === "week" && (
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(7, minmax(130px, 1fr))`, minWidth: 910 }}>
              {weekDays.map(day => {
                const dayStr    = format(day, "yyyy-MM-dd")
                const isCurrentDay = isToday(day)
                const isActiveDay  = dayStr === date
                const dayLessons   = (weekLessons ?? [])
                  .filter(l => l.date === dayStr)
                  .sort((a, b) => a.startMin - b.startMin)

                return (
                  <div
                    key={dayStr}
                    className={`flex flex-col border-l border-border/50 first:border-l-0 ${
                      isActiveDay ? "bg-primary/3" : ""
                    }`}
                  >
                    {/* Cabeçalho do dia */}
                    <button
                      className={`sticky top-0 z-10 flex flex-col items-center px-2 py-2.5 border-b border-border backdrop-blur-sm transition-colors hover:bg-muted/40 ${
                        isCurrentDay
                          ? "bg-primary/10"
                          : "bg-background/95"
                      }`}
                      onClick={() => {
                        setCurDate(dayStr)
                        setView("day")
                        pushUrl(dayStr, "day")
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {format(day, "EEE", { locale: ptBR })}
                      </p>
                      <p className={`text-2xl font-bold leading-tight ${isCurrentDay ? "text-primary" : ""}`}>
                        {format(day, "d")}
                      </p>
                      <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full mt-0.5 font-medium ${
                        dayLessons.length > 0
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground/40"
                      }`}>
                        {dayLessons.length > 0 ? dayLessons.length : "—"}
                        {dayLessons.length > 0 && (dayLessons.length === 1 ? " aula" : " aulas")}
                      </span>
                      {weekPendingRequests.filter(r => r.date === dayStr).length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full mt-0.5 font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                          <AlertCircle className="w-2.5 h-2.5" />
                          {weekPendingRequests.filter(r => r.date === dayStr).length}
                        </span>
                      )}
                    </button>

                    {/* Lista de aulas do dia */}
                    <div className="flex-1 p-1.5 space-y-1 min-h-48">
                      {dayLessons.length === 0 && weekPendingRequests.filter(r => r.date === dayStr).length === 0 ? (
                        <div className="flex items-center justify-center h-20">
                          <span className="text-[10px] text-muted-foreground/30">sem aulas</span>
                        </div>
                      ) : (
                        <>
                        {dayLessons.map(lesson => {
                          const tName = effectiveTeachers.find(t => t.id === lesson.teacherId)?.name ?? ""
                          const { bg, text: txtCls } = STATUS_STYLE[lesson.status]
                          return (
                            <button
                              key={lesson.id}
                              className={`w-full text-left rounded-md px-2 py-1.5 transition-opacity hover:opacity-80 active:opacity-60 ${bg} ${txtCls}`}
                              onClick={() => setSelectedLesson(lesson)}
                            >
                              <p className="text-[11px] font-bold">{lesson.time}</p>
                              <p className="text-[11px] font-semibold truncate">
                                {lesson.studentName.split(" ")[0]}
                                {lesson.studentName.split(" ")[1] && (
                                  <span className="opacity-80"> {lesson.studentName.split(" ")[1][0]}.</span>
                                )}
                              </p>
                              <p className="text-[9px] opacity-75 truncate">
                                {tName.split(" ")[0]} · {lesson.subjectName}
                              </p>
                            </button>
                          )
                        })}
                        {weekPendingRequests.filter(r => r.date === dayStr).map(req => (
                          <button
                            key={req.id}
                            className="w-full text-left rounded-md px-2 py-1.5 border-2 border-dashed border-orange-400 bg-orange-50 text-orange-900 transition-all hover:bg-orange-100 active:opacity-70"
                            onClick={() => setSelectedPending(req)}
                          >
                            <p className="text-[11px] font-bold flex items-center gap-1">
                              {req.time} <AlertCircle className="w-2.5 h-2.5 opacity-60" />
                            </p>
                            <p className="text-[11px] font-semibold truncate">
                              {req.studentName.split(" ")[0]}
                              {req.studentName.split(" ")[1] && (
                                <span className="opacity-75"> {req.studentName.split(" ")[1][0]}.</span>
                              )}
                            </p>
                            <p className="text-[9px] opacity-70 truncate">
                              {effectiveTeachers.find(t => t.id === req.teacherId)?.name.split(" ")[0]} · {req.subjectName}
                            </p>
                          </button>
                        ))}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── VISUALIZAÇÃO: DIA ────────────────────────────── */}
        {view === "day" && (
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
            <div style={{ minWidth: totalW }}>

              {/* Cabeçalho de professores (sticky top) */}
              <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur-sm">
                <div
                  style={{ width: TIME_W, minWidth: TIME_W }}
                  className="sticky left-0 z-30 bg-background/95 border-r border-border shrink-0 flex flex-col items-center justify-center gap-0.5 py-2">
                  <span className="text-[10px] font-bold text-primary tabular-nums">{roomCount}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">sala{roomCount !== 1 ? "s" : ""}</span>
                </div>
                {effectiveTeachers.map(t => {
                  const count        = byTeacher(t.id).length
                  const pendingCount = pendingRequests.filter(r => r.teacherId === t.id).length
                  const available    = t.slots.length > 0
                  const firstName    = t.name.split(" ")[0]
                  const lastName     = t.name.split(" ").slice(1).join(" ")

                  return (
                    <div
                      key={t.id}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className={`px-3 py-2 border-l border-border flex flex-col items-center gap-1 ${
                        !available ? "bg-muted/25" : ""
                      }`}
                    >
                      {/* Nome */}
                      <p className="text-xs font-bold leading-tight truncate w-full text-center">
                        {firstName}
                        {lastName && (
                          <span className="hidden lg:inline font-normal text-muted-foreground"> {lastName}</span>
                        )}
                      </p>

                      {/* Disponibilidade */}
                      {available ? (
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {t.slots.map((s, i) => (
                            <span key={i} className="text-[10px] text-emerald-700 font-medium tabular-nums">
                              {i > 0 && <span className="text-muted-foreground/50 mx-0.5">·</span>}
                              {String(Math.floor(s.start / 60)).padStart(2, "0")}h–{String(Math.floor(s.end / 60)).padStart(2, "0")}h
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">sem agenda hoje</span>
                      )}

                      {/* Contadores */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        {count > 0 ? (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {count} aula{count !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">livre</span>
                        )}
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-bold leading-none">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            {pendingCount}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Corpo: horários + colunas */}
              <div className="flex">
                {/* Coluna de horários (sticky left) */}
                <div
                  style={{ width: TIME_W, minWidth: TIME_W, height: TOTAL * HOUR_H }}
                  className="sticky left-0 z-10 bg-background border-r border-border shrink-0"
                >
                  {hours.map(h => {
                    const used = roomUsage(h)
                    const full = used >= roomCount
                    const warn = used === roomCount - 1
                    return (
                      <div key={h} style={{ height: HOUR_H }}
                        className={`flex flex-col items-end justify-start pr-1.5 pt-1 border-b border-border/30 ${
                          full ? "bg-red-50/60 dark:bg-red-950/20" :
                          warn ? "bg-yellow-50/60 dark:bg-yellow-950/20" : ""
                        }`}>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {String(h).padStart(2, "0")}:00
                        </span>
                        {used > 0 && (
                          <span className={`text-[9px] tabular-nums font-medium leading-tight ${
                            full ? "text-red-600" : warn ? "text-yellow-600" : "text-muted-foreground/60"
                          }`}>
                            {used}/{roomCount}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Colunas dos professores */}
                {effectiveTeachers.map((t, colIdx) => {
                  const hasAvailToday = t.slots.length > 0
                  const canSchedule   = hasAvailToday && !!students?.length
                  const ghostTime     = hoveredCell?.teacherId === t.id
                    ? `${String(Math.floor(hoveredCell.timeMin / 60)).padStart(2, "0")}:${String(hoveredCell.timeMin % 60).padStart(2, "0")}`
                    : null

                  return (
                    <div
                      key={t.id}
                      style={{ width: COL_W, minWidth: COL_W, height: TOTAL * HOUR_H }}
                      className={`relative ${colIdx > 0 ? "border-l border-border/50" : ""} ${
                        !hasAvailToday ? "bg-muted/25" : ""
                      } ${canSchedule ? "cursor-cell" : "cursor-default"}`}
                      onMouseMove={(e) => handleMouseMove(t, e)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={(e) => handleColumnClick(t, e)}
                    >
                      {/* Disponibilidade (fundo verde) */}
                      {t.slots.map((slot, i) => {
                        const top    = px(slot.start - START * 60)
                        const height = px(slot.end - slot.start)
                        if (top < 0 || height <= 0) return null
                        return (
                          <div key={i}
                            style={{ top, height, left: 0, right: 0 }}
                            className="absolute bg-emerald-50/70 dark:bg-emerald-950/20 pointer-events-none z-0"
                          />
                        )
                      })}

                      {/* Linhas de hora */}
                      {hours.map(h => (
                        <div key={h}
                          style={{ top: (h - START) * HOUR_H }}
                          className="absolute inset-x-0 border-t border-border/30 pointer-events-none z-1"
                        />
                      ))}
                      {hours.map(h => (
                        <div key={`hh${h}`}
                          style={{ top: (h - START) * HOUR_H + HOUR_H / 2 }}
                          className="absolute inset-x-0 border-t border-border/15 border-dashed pointer-events-none z-1"
                        />
                      ))}

                      {/* Ghost block — preview de horário ao hover */}
                      {ghostTime && (
                        <div
                          style={{
                            top:    px(hoveredCell!.timeMin - START * 60),
                            height: px(60),
                            left:   3,
                            right:  3,
                          }}
                          className="absolute rounded-lg border-2 border-dashed border-primary/70 bg-primary/10 pointer-events-none z-5 flex flex-col items-center justify-center gap-0.5 select-none"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary/60" />
                          <span className="text-[12px] font-bold text-primary">{ghostTime}</span>
                          <span className="text-[9px] text-primary/60">clique para agendar</span>
                        </div>
                      )}

                      {/* Linha de horário atual */}
                      {nowTop !== null && (
                        <div
                          style={{ top: nowTop }}
                          className="absolute inset-x-0 border-t-2 border-red-500 z-10 pointer-events-none"
                        >
                          <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                        </div>
                      )}

                      {/* Solicitações pendentes */}
                      {pendingRequests.filter(r => r.teacherId === t.id).map(req => (
                        <PendingBlock key={req.id} req={req} onSelect={setSelectedPending} />
                      ))}

                      {/* Blocos de aula (sobre as pendentes) */}
                      {byTeacher(t.id).map(lesson => (
                        <LessonBlock key={lesson.id} lesson={lesson} onSelect={setSelectedLesson} />
                      ))}
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        )}

        {effectiveTeachers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum professor cadastrado</p>
          </div>
        )}
      </div>

      {/* ── Modais ───────────────────────────────────────────── */}
      {selectedLesson && (
        <LessonDetailModal
          lesson={selectedLesson}
          teacherName={effectiveTeachers.find(t => t.id === selectedLesson.teacherId)?.name ?? ""}
          onClose={() => { setSelectedLesson(null); fetchData(curDate, view) }}
        />
      )}
      {selectedPending && (
        <PendingApprovalModal
          req={selectedPending}
          teacherName={effectiveTeachers.find(t => t.id === selectedPending.teacherId)?.name ?? ""}
          lessons={lessons}
          onClose={() => { setSelectedPending(null); fetchData(curDate, view) }}
        />
      )}
      {quickSchedule && students && (
        <QuickScheduleModal
          schedule={quickSchedule}
          date={curDate}
          students={students}
          teachers={effectiveTeachers}
          onClose={() => { setQuickSchedule(null); fetchData(curDate, view) }}
        />
      )}
      {showGroupDialog && allStudents && (
        <CreateGroupLessonDialog
          open={showGroupDialog}
          onClose={() => { setShowGroupDialog(false); fetchData(curDate, view) }}
          students={allStudents}
          teachers={effectiveTeachers.map(t => ({
            id:           t.id,
            name:         t.name,
            teachingMode: t.teachingMode,
            subjects:     t.subjects ?? [],
          }))}
          defaultDate={curDate}
        />
      )}
    </>
  )
}
