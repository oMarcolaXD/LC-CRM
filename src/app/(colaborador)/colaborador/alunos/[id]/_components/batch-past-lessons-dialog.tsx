"use client"

import { useState, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { createBatchPastLessonsAction } from "@/lib/actions/lesson-request"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import {
  CalendarDays, Loader2, CheckCircle2, XCircle,
  MonitorPlay, School, Plus, Trash2, Wand2, Users,
} from "lucide-react"

interface Subject { id: string; name: string }
interface Teacher { id: string; name: string; subjects: Subject[] }
interface Student { id: string; name: string }
type LessonStatus = "COMPLETED" | "MISSED"

interface LessonRow {
  date:      string
  time:      string
  teacherId: string
  subjectId: string
  status:    LessonStatus
  duration:  number
  partnerId: string   // 2º aluno da dupla ("" = sozinho)
}

interface Props {
  studentId:     string
  packageId:     string
  studentName:   string
  totalLessons:  number
  teachers:      Teacher[]
  otherStudents?: Student[]
}

// 07:00 to 22:00 in 30-min steps
const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const total = 7 * 60 + i * 30
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
})

const WEEKDAYS = [
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
]

function emptyRow(teachers: Teacher[], duration = 60): LessonRow {
  const t = teachers[0]
  return { date: "", time: "08:00", teacherId: t?.id ?? "", subjectId: t?.subjects[0]?.id ?? "", status: "COMPLETED", duration, partnerId: "" }
}

// Returns the N most recent past dates (incl. today) for the given weekdays, oldest first
function generatePastDates(weekdays: number[], count: number): string[] {
  if (!weekdays.length || count <= 0) return []
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (dates.length < count) {
    if (weekdays.includes(cursor.getDay())) {
      dates.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates.reverse()
}

export function BatchPastLessonsDialog({
  studentId, packageId, studentName, totalLessons, teachers, otherStudents = [],
}: Props) {
  const router = useRouter()
  const [open,    setOpen]   = useState(false)
  const [pending, start]     = useTransition()

  const [modality,     setModality]     = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [lessons,      setLessons]      = useState<LessonRow[]>([])
  const [quickDays,    setQuickDays]    = useState<number[]>([])
  const [defaultTime,  setDefaultTime]  = useState("08:00")

  function handleOpen(v: boolean) {
    if (v) {
      setModality("PRESENCIAL")
      setQuickDays([])
      setDefaultTime("08:00")
      const fullCount = Math.floor(totalLessons)
      const hasHalf   = totalLessons % 1 >= 0.5
      const rows = Array.from({ length: fullCount }, () => emptyRow(teachers, 60))
      if (hasHalf) rows.push(emptyRow(teachers, 30))
      setLessons(rows)
    }
    setOpen(v)
  }

  function updateRow(i: number, field: keyof LessonRow, value: string) {
    setLessons(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated: LessonRow = { ...r, [field]: field === "duration" ? parseInt(value) : value }
      if (field === "teacherId") {
        const t = teachers.find(x => x.id === value)
        updated.subjectId = t?.subjects[0]?.id ?? ""
      }
      return updated
    }))
  }

  function addRow() { setLessons(prev => [...prev, emptyRow(teachers, 60)]) }
  function removeRow(i: number) { setLessons(prev => prev.filter((_, idx) => idx !== i)) }

  function toggleQuickDay(day: number) {
    setQuickDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function applyQuickFill() {
    const emptyCount = lessons.filter(r => !r.date).length || lessons.length
    const dates = generatePastDates(quickDays, emptyCount)
    let di = 0
    setLessons(prev => prev.map(row => {
      if (!row.date && di < dates.length) return { ...row, date: dates[di++], time: defaultTime }
      return row
    }))
  }

  function applyTimeToAll() {
    setLessons(prev => prev.map(row => ({ ...row, time: defaultTime })))
  }

  function submit() {
    const toRegister = lessons.filter(r => r.date.trim())
    if (!toRegister.length)                   { toast.error("Preencha ao menos uma data"); return }
    if (toRegister.some(r => !r.teacherId))   { toast.error("Selecione o professor em todas as aulas"); return }
    if (toRegister.some(r => !r.subjectId))   { toast.error("Selecione a matéria em todas as aulas"); return }

    start(async () => {
      try {
        await createBatchPastLessonsAction({ studentId, packageId, modality, lessons: toRegister })
        const n = toRegister.length
        toast.success(`${n} aula${n !== 1 ? "s" : ""} registrada${n !== 1 ? "s" : ""}`)
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao registrar aulas")
      }
    })
  }

  const filled = lessons.filter(r => r.date).length
  const partnerOptions = otherStudents.filter(s => s.id !== studentId)

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => handleOpen(true)}>
        <CalendarDays className="w-3.5 h-3.5" />
        Registrar aulas
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Registrar aulas do pacote — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Global: modalidade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modalidade</Label>
              <div className="flex gap-2">
                {(["PRESENCIAL", "ONLINE"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModality(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium transition-colors ${
                      modality === m
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {m === "PRESENCIAL"
                      ? <><School className="w-3.5 h-3.5" /> Presencial</>
                      : <><MonitorPlay className="w-3.5 h-3.5" /> Online</>
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Quick-fill */}
            <div className="rounded-xl border border-dashed bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Preenchimento rápido de datas</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0">Dias da semana:</span>
                {WEEKDAYS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleQuickDay(d.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      quickDays.includes(d.value)
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0">Horário padrão:</span>
                <select
                  value={defaultTime}
                  onChange={e => setDefaultTime(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={applyTimeToAll}>
                  Aplicar horário a todas
                </Button>
                <Button
                  type="button" size="sm" className="h-8 text-xs gap-1.5"
                  disabled={!quickDays.length}
                  onClick={applyQuickFill}
                >
                  <Wand2 className="w-3 h-3" /> Gerar datas
                </Button>
              </div>
            </div>

            {/* Lesson rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datas das aulas</p>
                <span className="text-xs text-muted-foreground">{filled} de {lessons.length} preenchidas</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {lessons.map((row, i) => {
                  const rowTeacher  = teachers.find(t => t.id === row.teacherId)
                  const rowSubjects = rowTeacher?.subjects ?? []
                  return (
                    <div key={i} className="rounded-xl border bg-card p-2.5 space-y-2">
                      {/* Linha 1: número, data, horário, duração, status, excluir */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          value={row.date}
                          onChange={e => updateRow(i, "date", e.target.value)}
                          className="h-8 text-xs flex-1 min-w-0 px-2"
                        />
                        <select
                          value={row.time}
                          onChange={e => updateRow(i, "time", e.target.value)}
                          className="h-8 w-18 rounded-lg border border-input bg-background px-1.5 text-xs shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateRow(i, "duration", row.duration === 60 ? "30" : "60")}
                          title={row.duration === 60 ? "Aula inteira (60 min) — clique para meia aula" : "Meia aula (30 min) — clique para aula inteira"}
                          className={`h-8 px-2 rounded-lg border text-xs font-bold shrink-0 transition-colors ${
                            row.duration === 30
                              ? "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {row.duration === 30 ? "½" : "1"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRow(i, "status", row.status === "COMPLETED" ? "MISSED" : "COMPLETED")}
                          title={row.status === "COMPLETED" ? "Realizada — clique para marcar como falta" : "Falta — clique para marcar como realizada"}
                          className={`h-8 px-2 rounded-lg border text-xs font-medium shrink-0 transition-colors ${
                            row.status === "COMPLETED"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-red-100 text-red-700 border-red-300"
                          }`}
                        >
                          {row.status === "COMPLETED"
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : <XCircle className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Linha 2: professor e matéria */}
                      <div className="flex gap-2 pl-7">
                        <select
                          value={row.teacherId}
                          onChange={e => updateRow(i, "teacherId", e.target.value)}
                          className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Professor</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select
                          value={row.subjectId}
                          onChange={e => updateRow(i, "subjectId", e.target.value)}
                          disabled={rowSubjects.length === 0}
                          className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="">Matéria</option>
                          {rowSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>

                      {/* Linha 3: dupla (opcional) */}
                      {partnerOptions.length > 0 && (
                        <div className="flex items-center gap-2 pl-7">
                          <Users className={`w-3.5 h-3.5 shrink-0 ${row.partnerId ? "text-primary" : "text-muted-foreground"}`} />
                          <select
                            value={row.partnerId}
                            onChange={e => updateRow(i, "partnerId", e.target.value)}
                            className={`h-8 flex-1 rounded-lg border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring ${
                              row.partnerId ? "border-primary/40 text-primary" : "border-input"
                            }`}
                          >
                            <option value="">Sozinho (individual)</option>
                            {partnerOptions.map(s => (
                              <option key={s.id} value={s.id}>Em grupo com {s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={addRow}>
                <Plus className="w-3.5 h-3.5" /> Adicionar linha
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || filled === 0}>
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                : <><CalendarDays className="w-4 h-4 mr-2" /> Registrar {filled > 0 ? filled : ""} aula{filled !== 1 ? "s" : ""}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
