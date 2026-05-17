"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { addDays, format, isToday, parseISO, startOfWeek } from "date-fns"
import { ptBR }                    from "date-fns/locale"
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange,
  CheckCircle2, XCircle, UserX, MessageCircle,
  Loader2, Wifi, MapPin, Clock, Plus, Building2, Home,
} from "lucide-react"
import { Button }                  from "@/components/ui/button"
import { updateLessonStatusAction } from "@/lib/actions/lesson-request"
import { sendLessonWhatsAppAction } from "@/lib/actions/colaborador"
import { createLessonDirectAction } from "@/lib/actions/lesson-request"
import { toast }                   from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"

// ─── Constantes de layout ────────────────────────────────────────────────────

const HOUR_H = 72
const COL_W  = 160
const TIME_W = 52
const START  = 7
const END    = 21
const TOTAL  = END - START

const px = (min: number) => (min / 60) * HOUR_H

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ViewMode = "day" | "week"
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
  id:       string
  name:     string
  slots:    AvailSlot[]
  subjects?: SubjectOption[]
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
  const teacher = teachers.find(t => t.id === schedule.teacherId)
  const [studentId, setStudentId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [modality,  setModality]  = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [pending, start] = useTransition()

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
        })
        toast.success("Aula agendada com sucesso")
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
            <Plus className="w-4 h-4 text-primary" />
            Agendar Aula
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
          </div>
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

// ─── Grade principal ──────────────────────────────────────────────────────────

interface AgendaGridProps {
  date:         string
  teachers:     TeacherCol[]
  lessons:      LessonSlot[]
  roomCount?:   number
  students?:    StudentOption[]
  weekLessons?: WeekLessonSlot[]
  initialView?: ViewMode
}

export function AgendaGrid({
  date, teachers, lessons, roomCount = 3, students,
  weekLessons, initialView = "day",
}: AgendaGridProps) {
  const router = useRouter()
  const parsed = parseISO(date)
  const today  = isToday(parsed)

  const [view, setView]                 = useState<ViewMode>(initialView)
  const [selectedLesson, setSelectedLesson] = useState<LessonSlot | null>(null)
  const [quickSchedule,  setQuickSchedule]  = useState<{
    teacherId:   string
    teacherName: string
    time:        string
  } | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{
    teacherId: string
    timeMin:   number
  } | null>(null)

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigate = (delta: number) => {
    const step  = view === "week" ? delta * 7 : delta
    const param = view === "week" ? `view=week&date=` : `date=`
    router.push(`?${param}${format(addDays(parsed, step), "yyyy-MM-dd")}`)
  }

  const switchView = (v: ViewMode) => {
    setView(v)
    setHoveredCell(null)
    if (v === "week") {
      router.push(`?view=week&date=${date}`)
    } else {
      router.push(`?date=${date}`)
    }
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

  const totalW = TIME_W + teachers.length * COL_W

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">

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
              {(!today || view === "week") && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => router.push(view === "week"
                    ? `?view=week&date=${format(new Date(), "yyyy-MM-dd")}`
                    : `?date=${format(new Date(), "yyyy-MM-dd")}`
                  )}
                >
                  Hoje
                </Button>
              )}
            </div>

            {/* Toggle Dia / Semana */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden h-7">
              <button
                onClick={() => switchView("day")}
                className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium transition-colors ${
                  view === "day"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted/50 bg-background"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Dia
              </button>
              <button
                onClick={() => switchView("week")}
                className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium transition-colors border-l border-border ${
                  view === "week"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted/50 bg-background"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Semana
              </button>
            </div>
          </div>

          {/* Centro: data */}
          <div className="flex items-center gap-2">
            {view === "week" ? (
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

          {/* Direita: contagem + legenda */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {view === "week"
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
                      isActiveDay ? "bg-primary/[0.03]" : ""
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
                        setView("day")
                        router.push(`?date=${dayStr}`)
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
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
                    </button>

                    {/* Lista de aulas do dia */}
                    <div className="flex-1 p-1.5 space-y-1 min-h-48">
                      {dayLessons.length === 0 ? (
                        <div className="flex items-center justify-center h-20">
                          <span className="text-[10px] text-muted-foreground/30">sem aulas</span>
                        </div>
                      ) : (
                        dayLessons.map(lesson => {
                          const tName = teachers.find(t => t.id === lesson.teacherId)?.name ?? ""
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
                        })
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
                  className="sticky left-0 z-30 bg-background/95 border-r border-border shrink-0 flex flex-col items-center justify-end pb-1.5">
                  <span className="text-[9px] text-muted-foreground leading-tight">Salas</span>
                  <span className="text-[10px] font-bold text-primary">{roomCount}</span>
                </div>
                {teachers.map(t => {
                  const count     = byTeacher(t.id).length
                  const available = t.slots.length > 0
                  return (
                    <div
                      key={t.id}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className={`px-2 py-2 text-center border-l border-border ${
                        !available ? "bg-muted/20" : ""
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{t.name.split(" ")[0]}
                        <span className="hidden lg:inline"> {t.name.split(" ").slice(1).join(" ")}</span>
                      </p>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {count} aula{count !== 1 ? "s" : ""}
                        </span>
                        {available ? (
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-full font-medium">
                            disponível
                          </span>
                        ) : (
                          <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded-full">
                            indisponível
                          </span>
                        )}
                      </div>
                      {available && (
                        <div className="flex gap-0.5 justify-center mt-1">
                          {t.slots.map((s, i) => (
                            <span key={i} className="text-[8px] text-emerald-600 font-medium">
                              {String(Math.floor(s.start / 60)).padStart(2, "0")}–{String(Math.floor(s.end / 60)).padStart(2, "0")}
                            </span>
                          ))}
                        </div>
                      )}
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
                {teachers.map((t, colIdx) => {
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
                          className="absolute inset-x-0 border-t border-border/30 pointer-events-none z-[1]"
                        />
                      ))}
                      {hours.map(h => (
                        <div key={`hh${h}`}
                          style={{ top: (h - START) * HOUR_H + HOUR_H / 2 }}
                          className="absolute inset-x-0 border-t border-border/15 border-dashed pointer-events-none z-[1]"
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
                          className="absolute rounded-lg border-2 border-dashed border-primary/70 bg-primary/10 pointer-events-none z-[5] flex flex-col items-center justify-center gap-0.5 select-none"
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

                      {/* Blocos de aula */}
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

        {teachers.length === 0 && (
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
          teacherName={teachers.find(t => t.id === selectedLesson.teacherId)?.name ?? ""}
          onClose={() => setSelectedLesson(null)}
        />
      )}
      {quickSchedule && students && (
        <QuickScheduleModal
          schedule={quickSchedule}
          date={date}
          students={students}
          teachers={teachers}
          onClose={() => setQuickSchedule(null)}
        />
      )}
    </>
  )
}
