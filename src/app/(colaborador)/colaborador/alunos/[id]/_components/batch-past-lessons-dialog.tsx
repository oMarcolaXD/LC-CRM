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
  MonitorPlay, School, Plus, Trash2,
} from "lucide-react"

interface Subject { id: string; name: string }
interface Teacher { id: string; name: string; subjects: Subject[] }
type LessonStatus = "COMPLETED" | "MISSED"
interface LessonRow { date: string; time: string; status: LessonStatus }

interface Props {
  studentId:    string
  studentName:  string
  totalLessons: number
  teachers:     Teacher[]
}

function emptyRow(): LessonRow {
  return { date: "", time: "08:00", status: "COMPLETED" }
}

export function BatchPastLessonsDialog({
  studentId, studentName, totalLessons, teachers,
}: Props) {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [pending, start]  = useTransition()

  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "")
  const [subjectId, setSubjectId] = useState(teachers[0]?.subjects[0]?.id ?? "")
  const [modality,  setModality]  = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [duration,  setDuration]  = useState("60")
  const [lessons,   setLessons]   = useState<LessonRow[]>(() =>
    Array.from({ length: totalLessons }, emptyRow)
  )

  const selectedTeacher   = teachers.find(t => t.id === teacherId)
  const availableSubjects = selectedTeacher?.subjects ?? []

  function handleTeacherChange(tid: string) {
    setTeacherId(tid)
    const t = teachers.find(x => x.id === tid)
    const subs = t?.subjects ?? []
    if (!subs.find(s => s.id === subjectId)) {
      setSubjectId(subs[0]?.id ?? "")
    }
  }

  function handleOpen(v: boolean) {
    if (v) {
      const firstTeacher = teachers[0]
      setTeacherId(firstTeacher?.id ?? "")
      setSubjectId(firstTeacher?.subjects[0]?.id ?? "")
      setModality("PRESENCIAL")
      setDuration("60")
      setLessons(Array.from({ length: totalLessons }, emptyRow))
    }
    setOpen(v)
  }

  function updateRow(i: number, field: keyof LessonRow, value: string) {
    setLessons(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setLessons(prev => [...prev, emptyRow()])
  }

  function removeRow(i: number) {
    setLessons(prev => prev.filter((_, idx) => idx !== i))
  }

  function submit() {
    const toRegister = lessons.filter(r => r.date.trim())
    if (!toRegister.length) { toast.error("Preencha ao menos uma data"); return }
    if (!teacherId)         { toast.error("Selecione o professor"); return }
    if (!subjectId)         { toast.error("Selecione a matéria"); return }

    start(async () => {
      try {
        await createBatchPastLessonsAction({
          studentId,
          teacherId,
          subjectId,
          modality,
          duration: parseInt(duration) || 60,
          lessons:  toRegister,
        })
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-7 text-xs"
        onClick={() => handleOpen(true)}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        Registrar aulas
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Registrar aulas do pacote — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Professor e Matéria */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Professor *</Label>
                <select
                  value={teacherId}
                  onChange={e => handleTeacherChange(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Matéria *</Label>
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={availableSubjects.length === 0}
                >
                  <option value="">Selecione</option>
                  {availableSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number" min={30} max={240} step={30}
                  value={duration} onChange={e => setDuration(e.target.value)}
                  className="h-9"
                />
              </div>
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
            </div>

            {/* Linhas de datas */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Datas das aulas
                </p>
                <span className="text-xs text-muted-foreground">
                  {filled} de {lessons.length} preenchidas
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {lessons.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={row.date}
                      onChange={e => updateRow(i, "date", e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <Input
                      type="time"
                      value={row.time}
                      onChange={e => updateRow(i, "time", e.target.value)}
                      className="h-8 text-sm w-24 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => updateRow(i, "status", row.status === "COMPLETED" ? "MISSED" : "COMPLETED")}
                      className={`h-8 px-2 rounded-lg border text-xs font-medium shrink-0 transition-colors ${
                        row.status === "COMPLETED"
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-red-100 text-red-700 border-red-300"
                      }`}
                      title="Clique para alternar realizada/falta"
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
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs h-8"
                onClick={addRow}
              >
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
