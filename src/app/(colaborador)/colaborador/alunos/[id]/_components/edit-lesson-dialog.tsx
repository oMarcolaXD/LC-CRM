"use client"

import { useState, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { updateLessonDirectAction } from "@/lib/actions/lesson-request"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Pencil, Loader2, MonitorPlay, School } from "lucide-react"

interface Subject { id: string; name: string }
interface Teacher { id: string; name: string; subjects: Subject[] }

interface Props {
  lesson: {
    id:            string
    date:          string   // "yyyy-MM-dd" pré-formatado
    time:          string   // "HH:mm" pré-formatado
    status:        string
    teacherId:     string
    subjectId:     string | null
    modality:      string
    duration:      number | null
    topicsCovered: string | null
    teacherNotes:  string | null
  }
  studentId: string
  teachers:  Teacher[]
}

const STATUSES = [
  { value: "COMPLETED", label: "Realizada"  },
  { value: "MISSED",    label: "Faltou"     },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "CANCELLED", label: "Cancelada"  },
  { value: "SCHEDULED", label: "Agendada"   },
]

export function EditLessonDialog({ lesson, studentId, teachers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [date,     setDate]    = useState(lesson.date)
  const [time,     setTime]    = useState(lesson.time)
  const [teacherId, setTeacherId] = useState(lesson.teacherId)
  const [subjectId, setSubjectId] = useState(lesson.subjectId ?? "")
  const [modality,  setModality]  = useState<"PRESENCIAL" | "ONLINE">(
    lesson.modality === "ONLINE" ? "ONLINE" : "PRESENCIAL"
  )
  const [duration,  setDuration]  = useState(String(lesson.duration ?? 60))
  const [topics,    setTopics]    = useState(lesson.topicsCovered ?? "")
  const [notes,     setNotes]     = useState(lesson.teacherNotes ?? "")
  const [status,    setStatus]    = useState(lesson.status)

  const selectedTeacher   = teachers.find(t => t.id === teacherId)
  const availableSubjects = selectedTeacher?.subjects ?? []

  function handleTeacherChange(tid: string) {
    setTeacherId(tid)
    const subs = teachers.find(t => t.id === tid)?.subjects ?? []
    if (!subs.find(s => s.id === subjectId)) setSubjectId(subs[0]?.id ?? "")
  }

  function handleOpen(v: boolean) {
    if (v) {
      setDate(lesson.date); setTime(lesson.time)
      setTeacherId(lesson.teacherId)
      setSubjectId(lesson.subjectId ?? "")
      setModality(lesson.modality === "ONLINE" ? "ONLINE" : "PRESENCIAL")
      setDuration(String(lesson.duration ?? 60))
      setTopics(lesson.topicsCovered ?? "")
      setNotes(lesson.teacherNotes ?? "")
      setStatus(lesson.status)
    }
    setOpen(v)
  }

  function submit() {
    if (!date || !teacherId || !subjectId) {
      toast.error("Preencha data, professor e matéria")
      return
    }
    start(async () => {
      try {
        await updateLessonDirectAction({
          lessonId:      lesson.id,
          studentId,
          date,
          time,
          teacherId,
          subjectId,
          modality,
          duration:      parseInt(duration) || 60,
          topicsCovered: topics || undefined,
          teacherNotes:  notes  || undefined,
          status:        status as "COMPLETED" | "MISSED" | "CONFIRMED" | "CANCELLED" | "SCHEDULED",
        })
        toast.success("Aula atualizada")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar aula")
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(true)}
        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Editar aula"
      >
        <Pencil className="w-3 h-3" />
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar Aula
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      status === s.value
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data e Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-9" />
              </div>
            </div>

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
                >
                  <option value="">Selecione</option>
                  {availableSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duração e Modalidade */}
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
                        : <><MonitorPlay className="w-3.5 h-3.5" /> Online</>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo abordado</Label>
              <Input
                value={topics}
                onChange={e => setTopics(e.target.value)}
                placeholder="Ex: Funções do 2º grau…"
                className="h-9"
              />
            </div>

            {/* Observações do professor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações do professor</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas internas"
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !date || !teacherId || !subjectId}>
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                : <><Pencil className="w-4 h-4 mr-2" /> Salvar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
