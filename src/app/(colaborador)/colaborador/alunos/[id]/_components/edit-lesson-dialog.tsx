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
import { Pencil, Loader2, MonitorPlay, School, Repeat2, CalendarCheck } from "lucide-react"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

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
    /** Preenchido quando a aula faz parte de uma série recorrente. */
    recurrenceGroupId?: string | null
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

/**
 * "Confirmada" só aparece se a aula JÁ estiver confirmada — para poder editar os
 * outros campos sem rebaixar o status. Confirmar é ação do botão Confirmar na
 * agenda, que notifica professor e responsável (ver confirmLessonAction).
 */
function statusOptions(current: string) {
  return current === "CONFIRMED" ? STATUSES : STATUSES.filter(s => s.value !== "CONFIRMED")
}

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
  const [duration,  setDuration]  = useState(() => {
    const aulas = (lesson.duration ?? 60) / 60
    return String(aulas).replace(".", ",")
  })
  const [topics,    setTopics]    = useState(lesson.topicsCovered ?? "")
  const [notes,     setNotes]     = useState(lesson.teacherNotes ?? "")
  const [status,    setStatus]    = useState(lesson.status)
  const [scope,     setScope]     = useState<"ONE" | "SERIES">("ONE")

  const selectedTeacher   = teachers.find(t => t.id === teacherId)
  const availableSubjects = selectedTeacher?.subjects ?? []

  // O alcance "série" só faz sentido enquanto a aula continua agendada: marcar
  // realizada/faltou/cancelada é sempre sobre esta ocorrência (ver editarAula).
  const emSerie     = !!lesson.recurrenceGroupId
  const statusAtivo = status === "SCHEDULED" || status === "CONFIRMED"
  const aplicaSerie = emSerie && scope === "SERIES" && statusAtivo
  const duracaoMudou =
    Math.round((parseFloat(duration.replace(",", ".")) || 1) * 60) !== (lesson.duration ?? 60)

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
      setDuration(() => { const a = (lesson.duration ?? 60) / 60; return String(a).replace(".", ",") })
      setTopics(lesson.topicsCovered ?? "")
      setNotes(lesson.teacherNotes ?? "")
      setStatus(lesson.status)
      setScope("ONE")
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
        const r = ouFalhe(await updateLessonDirectAction({
          lessonId:      lesson.id,
          studentId,
          date,
          time,
          teacherId,
          subjectId,
          modality,
          duration:      Math.round((parseFloat(duration.replace(",", ".")) || 1) * 60),
          topicsCovered: topics || undefined,
          teacherNotes:  notes  || undefined,
          status:        status as "COMPLETED" | "MISSED" | "CONFIRMED" | "CANCELLED" | "SCHEDULED",
          scope:         aplicaSerie ? "SERIES" : "ONE",
        }))
        toast.success(r.updated > 1
          ? `Série atualizada — ${r.updated} aulas remarcadas`
          : "Aula atualizada")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao atualizar aula"))
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
            {/* Alcance — só aparece quando a aula faz parte de uma série */}
            {emSerie && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Repeat2 className="w-3.5 h-3.5 text-primary" />
                  Esta aula se repete. O que você quer alterar?
                </p>
                <div className="flex rounded-lg border border-input overflow-hidden bg-background">
                  <button
                    type="button"
                    onClick={() => setScope("ONE")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                      scope === "ONE" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CalendarCheck className="w-3.5 h-3.5" /> Só esta
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("SERIES")}
                    disabled={!statusAtivo}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      scope === "SERIES" && statusAtivo ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Repeat2 className="w-3.5 h-3.5" /> Esta e as próximas
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {aplicaSerie
                    ? "As próximas aulas pendentes da série vão para o horário novo, deslocadas pelos mesmos dias que você mudar aqui. O que já passou não muda."
                    : !statusAtivo
                    ? "Realizada, faltou e cancelada valem só para esta aula — a série continua como está."
                    : "Conteúdo, observações e status são sempre só desta aula."}
                </p>
                {aplicaSerie && duracaoMudou && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Mudar o número de aulas não refaz o desconto no pacote — as aulas já foram
                    debitadas quando a série foi criada. Ajuste o saldo à mão, se precisar.
                  </p>
                )}
              </div>
            )}

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions(lesson.status).map(s => (
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
                <Label className="text-xs">Número de aulas</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="Ex: 1 ou 0,5"
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Prefira vírgula: 0,5 · 1 · 1,5</p>
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
