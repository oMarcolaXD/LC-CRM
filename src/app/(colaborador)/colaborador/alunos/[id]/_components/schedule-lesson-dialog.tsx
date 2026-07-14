"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { format }                  from "date-fns"
import { ptBR as ptBRLocale }       from "date-fns/locale"
import { Plus, Loader2, CalendarDays, Wifi, MapPin, Users, X, Repeat, AlertTriangle } from "lucide-react"
import { Button }                  from "@/components/ui/button"
import { Badge }                   from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { toast }  from "sonner"
import { createLessonDirectAction, createDuoLessonAction, createRecurringLessonsAction } from "@/lib/actions/lesson-request"

interface Teacher {
  id:       string
  name:     string
  subjects: { id: string; name: string }[]
}

interface Props {
  studentId:     string
  studentName:   string
  teachers:      Teacher[]
  hasBalance?:   boolean
  otherStudents?: { id: string; name: string }[]
}

export function ScheduleLessonDialog({ studentId, studentName, teachers, hasBalance = true, otherStudents = [] }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [teacherId, setTeacher] = useState("")
  const [subjectId, setSubject] = useState("")
  const [date, setDate]         = useState(format(new Date(), "yyyy-MM-dd"))
  const [time, setTime]         = useState("14:00")
  const [modality, setModality] = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [isDuo, setIsDuo]       = useState(false)
  const [duoIds, setDuoIds]     = useState<string[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [occurrences, setOccurrences] = useState(4)
  const [conflicts, setConflicts]     = useState<{ date: string; reason: string }[]>([])
  const [pending, start]        = useTransition()

  const selectedTeacher = teachers.find(t => t.id === teacherId)
  const subjects        = selectedTeacher?.subjects ?? []

  function toggleDuo(id: string) {
    setDuoIds(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : prev.length < 3 ? [...prev, id] : prev   // total máx. 4 (este + 3)
    )
  }

  function handleTeacherChange(val: string | null) {
    setTeacher(val ?? "")
    setSubject("")
  }

  function handleOpen(v: boolean) {
    if (v) {
      setTeacher("")
      setSubject("")
      setDate(format(new Date(), "yyyy-MM-dd"))
      setTime("14:00")
      setModality("PRESENCIAL")
      setIsDuo(false)
      setDuoIds([])
      setIsRecurring(false)
      setOccurrences(4)
    }
    setOpen(v)
  }

  function submit() {
    if (!teacherId || !subjectId || !date || !time) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    if (isDuo && duoIds.length < 1) {
      toast.error("Selecione ao menos mais um aluno para o grupo")
      return
    }
    start(async () => {
      try {
        if (isDuo) {
          await createDuoLessonAction({
            teacherId,
            subjectId,
            studentIds: [studentId, ...duoIds],
            date,
            time,
            modality,
          })
          toast.success("Aula em grupo (pacote) agendada com sucesso")
        } else if (isRecurring) {
          const r = await createRecurringLessonsAction({
            teacherId, studentId, subjectId, date, time, modality,
            occurrences,
          })
          const parts = [`${r.created} aula${r.created !== 1 ? "s" : ""} criada${r.created !== 1 ? "s" : ""}`]
          if (r.skippedNoBalance > 0) parts.push(`${r.skippedNoBalance} sem saldo`)
          setOpen(false)
          router.refresh()
          if (r.conflicts.length > 0) {
            setConflicts(r.conflicts)
            toast.warning(`Série criada, mas ${r.conflicts.length} horário${r.conflicts.length !== 1 ? "s têm" : " tem"} conflito`)
          } else {
            toast.success(`Série recorrente: ${parts.join(" · ")}`)
          }
          return
        } else {
          await createLessonDirectAction({ teacherId, studentId, subjectId, date, time, modality })
          toast.success("Aula agendada com sucesso")
        }
        setOpen(false)
        router.push(`/colaborador/alunos/${studentId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao agendar aula")
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => handleOpen(true)}
        disabled={!hasBalance}
        title={!hasBalance ? "Aluno sem saldo — adicione um pacote primeiro" : undefined}
      >
        <Plus className="w-4 h-4" />
        Marcar aula
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Agendar aula — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Aula em dupla */}
            {otherStudents.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { setIsDuo(v => !v); if (isDuo) setDuoIds([]) }}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isDuo
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {isDuo ? "Aula em grupo — pacote (ativada)" : "Aula em grupo (pacote)"}
                </button>

                {isDuo && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      {studentName.split(" ")[0]} + até 3 alunos. Cada um terá 1 aula descontada do seu pacote.
                    </p>
                    {duoIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {duoIds.map(did => {
                          const name = otherStudents.find(s => s.id === did)?.name ?? did
                          return (
                            <Badge
                              key={did}
                              variant="secondary"
                              className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-destructive/10"
                              onClick={() => toggleDuo(did)}
                            >
                              {name}
                              <X className="w-3 h-3" />
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-input bg-background divide-y">
                      {otherStudents.map(s => {
                        const selected = duoIds.includes(s.id)
                        const disabled = !selected && duoIds.length >= 3
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleDuo(s.id)}
                            className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                              selected
                                ? "bg-primary/10 text-primary font-medium"
                                : disabled
                                ? "text-muted-foreground/40 cursor-not-allowed"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Professor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Professor *</Label>
              <select
                value={teacherId}
                onChange={e => handleTeacherChange(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecionar professor</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Matéria */}
            <div className="space-y-1.5">
              <Label className="text-xs">Matéria *</Label>
              <select
                value={subjectId}
                onChange={e => setSubject(e.target.value)}
                disabled={!teacherId || subjects.length === 0}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">{teacherId ? "Selecionar matéria" : "Selecione um professor primeiro"}</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Data + Hora */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horário *</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Modalidade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modalidade</Label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setModality("PRESENCIAL")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "PRESENCIAL" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setModality("ONLINE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "ONLINE" ? "bg-[#219EBC] text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" /> Online
                </button>
              </div>
            </div>

            {/* Recorrência semanal (indisponível no modo grupo) */}
            {!isDuo && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsRecurring(v => !v)}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isRecurring
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                  {isRecurring ? "Aula recorrente (ativada)" : "Repetir semanalmente"}
                </button>

                {isRecurring && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Cria 1 aula por semana, sempre {date ? format(new Date(`${date}T00:00:00`), "EEEE", { locale: ptBRLocale }) : "no mesmo dia"} às {time}.
                      Desconta 1 aula do pacote por ocorrência — cria só o que couber no saldo.
                    </p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Quantas semanas</Label>
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={occurrences}
                        onChange={e => setOccurrences(Math.max(2, Math.min(52, parseInt(e.target.value, 10) || 2)))}
                        className="h-8 w-20"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !teacherId || !subjectId}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isRecurring && !isDuo ? "Agendar série" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aviso de conflitos da série recorrente */}
      <Dialog open={conflicts.length > 0} onOpenChange={(v) => { if (!v) setConflicts([]) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {conflicts.length} horário{conflicts.length !== 1 ? "s" : ""} não agendado{conflicts.length !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            As demais aulas da série foram criadas normalmente. Os horários abaixo foram
            pulados por conflito — reagende-os manualmente em outro horário:
          </p>

          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {conflicts.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">{c.date}</strong>
                  <span className="text-muted-foreground"> — {c.reason}</span>
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button onClick={() => setConflicts([])}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
