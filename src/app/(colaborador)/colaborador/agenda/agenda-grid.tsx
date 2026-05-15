"use client"

import { useRouter }    from "next/navigation"
import { addDays, format, isToday, parseISO } from "date-fns"
import { ptBR }         from "date-fns/locale"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button }       from "@/components/ui/button"
import { useTransition } from "react"
import { updateLessonStatusAction } from "@/lib/actions/lesson-request"
import { sendLessonWhatsAppAction }  from "@/lib/actions/colaborador"
import { toast }        from "sonner"
import { CheckCircle2, XCircle, UserX, MessageCircle, Loader2, Wifi, MapPin } from "lucide-react"

// ─── Constantes de layout ────────────────────────────────────────────────────

const HOUR_H = 72      // px por hora
const COL_W  = 160     // px por coluna de professor
const TIME_W = 52      // px da coluna de horário
const START  = 7       // 07:00
const END    = 21      // 21:00
const TOTAL  = END - START

const px = (min: number) => (min / 60) * HOUR_H

// ─── Tipos ───────────────────────────────────────────────────────────────────

type LessonStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED"

const STATUS_STYLE: Record<LessonStatus, { bg: string; text: string; border: string }> = {
  SCHEDULED: { bg: "bg-amber-400",   text: "text-amber-900",  border: "border-amber-500/80"  },
  CONFIRMED: { bg: "bg-[#219EBC]",   text: "text-white",      border: "border-[#1a7e96]"     },
  COMPLETED: { bg: "bg-slate-400",   text: "text-white",      border: "border-slate-500"     },
  CANCELLED: { bg: "bg-rose-400",    text: "text-white",      border: "border-rose-500"      },
  MISSED:    { bg: "bg-orange-400",  text: "text-white",      border: "border-orange-500"    },
}

const STATUS_LABEL: Record<LessonStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  MISSED:    "Faltou",
}

export interface TeacherCol {
  id:   string
  name: string
}

export interface LessonSlot {
  id:           string
  teacherId:    string
  startMin:     number   // minutos desde meia-noite
  duration:     number   // minutos (default 60)
  status:       LessonStatus
  modality:     "PRESENCIAL" | "ONLINE"
  time:         string   // "HH:mm"
  studentName:  string
  subjectName:  string
  guardianName: string | null
}

// ─── Bloco de aula dentro do grid ─────────────────────────────────────────────

function LessonBlock({ lesson }: { lesson: LessonSlot }) {
  const [pending, start] = useTransition()
  const { bg, text, border } = STATUS_STYLE[lesson.status]
  const height = Math.max(px(lesson.duration), 32)
  const canAct = lesson.status === "SCHEDULED" || lesson.status === "CONFIRMED"

  const act = (next: "COMPLETED" | "CANCELLED" | "MISSED") =>
    start(async () => {
      try {
        await updateLessonStatusAction(lesson.id, next)
        toast.success(
          next === "COMPLETED" ? "Aula realizada" :
          next === "CANCELLED" ? "Aula cancelada" : "Falta registrada"
        )
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
    <div
      style={{ top: px(lesson.startMin - START * 60), height, left: 3, right: 3 }}
      className={`absolute rounded-lg border overflow-hidden select-none ${bg} ${text} ${border} ${pending ? "opacity-60" : ""}`}
    >
      {/* Info principal */}
      <div className="px-1.5 pt-1 pb-0.5">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-bold leading-tight">{lesson.time}</p>
          {lesson.modality === "ONLINE"
            ? <Wifi className="w-2.5 h-2.5 opacity-80 shrink-0" />
            : <MapPin className="w-2.5 h-2.5 opacity-80 shrink-0" />
          }
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

      {/* Ações (só aparecem quando o bloco tem altura suficiente) */}
      {height >= 90 && (
        <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap">
          {canAct && (
            <>
              <button
                disabled={pending}
                onClick={e => { e.stopPropagation(); act("COMPLETED") }}
                className="flex items-center gap-0.5 text-[9px] bg-white/20 hover:bg-white/30 rounded px-1 py-0.5 transition-colors"
                title="Marcar como realizada"
              >
                {pending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                OK
              </button>
              <button
                disabled={pending}
                onClick={e => { e.stopPropagation(); act("CANCELLED") }}
                className="flex items-center gap-0.5 text-[9px] bg-white/20 hover:bg-white/30 rounded px-1 py-0.5 transition-colors"
                title="Cancelar aula"
              >
                <XCircle className="w-2.5 h-2.5" />
                Cancela
              </button>
              <button
                disabled={pending}
                onClick={e => { e.stopPropagation(); act("MISSED") }}
                className="flex items-center gap-0.5 text-[9px] bg-white/20 hover:bg-white/30 rounded px-1 py-0.5 transition-colors"
                title="Registrar falta"
              >
                <UserX className="w-2.5 h-2.5" />
                Faltou
              </button>
            </>
          )}
          <button
            disabled={pending}
            onClick={e => { e.stopPropagation(); whatsapp() }}
            className="flex items-center gap-0.5 text-[9px] bg-white/20 hover:bg-white/30 rounded px-1 py-0.5 transition-colors"
            title="Enviar confirmação WhatsApp"
          >
            <MessageCircle className="w-2.5 h-2.5" />
            WA
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Grade principal ──────────────────────────────────────────────────────────

interface AgendaGridProps {
  date:      string        // "YYYY-MM-DD"
  teachers:  TeacherCol[]
  lessons:   LessonSlot[]
  roomCount?: number
}

export function AgendaGrid({ date, teachers, lessons, roomCount = 3 }: AgendaGridProps) {
  const router = useRouter()
  const parsed = parseISO(date)
  const today  = isToday(parsed)

  const navigate = (delta: number) =>
    router.push(`?date=${format(addDays(parsed, delta), "yyyy-MM-dd")}`)

  // Linha de horário atual
  const now    = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowTop = today && nowMin >= START * 60 && nowMin <= END * 60
    ? px(nowMin - START * 60)
    : null

  const hours   = Array.from({ length: TOTAL }, (_, i) => START + i)
  const byTeacher = (id: string) => lessons.filter(l => l.teacherId === id)

  // Ocupação de salas presenciais por hora cheia
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

  const totalW = TIME_W + teachers.length * COL_W

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">

      {/* ── Navegação de data ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="h-7 w-7 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(1)} className="h-7 w-7 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!today && (
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => router.push(`?date=${format(new Date(), "yyyy-MM-dd")}`)}>
              Hoje
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold capitalize">
            {format(parsed, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          {today && (
            <span className="text-[11px] bg-primary text-white px-2 py-0.5 rounded-full font-medium">Hoje</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{lessons.length} aula{lessons.length !== 1 ? "s" : ""}</span>
          {/* Legenda de cores */}
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

      {/* ── Grid com scroll 2D ────────────────────────────────── */}
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <div style={{ minWidth: totalW }}>

          {/* Cabeçalho de professores (sticky top) */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur-sm">
            {/* Canto (sticky left + top) */}
            <div
              style={{ width: TIME_W, minWidth: TIME_W }}
              className="sticky left-0 z-30 bg-background/95 border-r border-border shrink-0"
            />
            {teachers.map(t => (
              <div
                key={t.id}
                style={{ width: COL_W, minWidth: COL_W }}
                className="px-2 py-2.5 text-center border-l border-border"
              >
                <p className="text-xs font-semibold truncate">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {byTeacher(t.id).length} aula{byTeacher(t.id).length !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
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
            {teachers.map((t, colIdx) => (
              <div
                key={t.id}
                style={{ width: COL_W, minWidth: COL_W, height: TOTAL * HOUR_H }}
                className={`relative ${colIdx > 0 ? "border-l border-border/50" : ""}`}
              >
                {/* Linhas de hora cheia */}
                {hours.map(h => (
                  <div key={h}
                    style={{ top: (h - START) * HOUR_H }}
                    className="absolute inset-x-0 border-t border-border/30 pointer-events-none"
                  />
                ))}
                {/* Linhas de meia hora (tracejadas) */}
                {hours.map(h => (
                  <div key={`hh${h}`}
                    style={{ top: (h - START) * HOUR_H + HOUR_H / 2 }}
                    className="absolute inset-x-0 border-t border-border/15 border-dashed pointer-events-none"
                  />
                ))}

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
                  <LessonBlock key={lesson.id} lesson={lesson} />
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>

      {teachers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <CalendarDays className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum professor cadastrado</p>
        </div>
      )}
    </div>
  )
}
