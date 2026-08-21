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
import { createLessonDirectAction, createDuoLessonAction } from "@/lib/actions/lesson-request"
import { weeklySlots } from "@/lib/recurrence"
import { RecurringPreviewDialog, type RecurringParams } from "@/components/shared/recurring-preview-dialog"
import { TeacherSubjectPicker } from "@/components/shared/teacher-subject-picker"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

interface Teacher {
  id:       string
  name:     string
  subjects: { id: string; name: string }[]
}

// Converte minutos em "N aula(s)" (1 aula = 60 min)
function fmtAulas(minutes: number): string {
  const n = minutes / 60
  const label = n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
  return `${label} aula${n === 1 ? "" : "s"}`
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
  const [duration, setDuration] = useState(60)
  const [isDuo, setIsDuo]       = useState(false)
  const [duoIds, setDuoIds]     = useState<string[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [occurrences, setOccurrences] = useState(4)
  const [alreadyAgreed, setAlreadyAgreed] = useState(false)
  const [conflicts, setConflicts]     = useState<{ date: string; reason: string }[]>([])
  const [recurringParams, setRecurringParams] = useState<RecurringParams | null>(null)
  const [pending, start]        = useTransition()

  function toggleDuo(id: string) {
    setDuoIds(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : prev.length < 3 ? [...prev, id] : prev   // total máx. 4 (este + 3)
    )
  }

  function handlePickerChange(next: { teacherId: string; subjectId: string }) {
    setTeacher(next.teacherId)
    setSubject(next.subjectId)
  }

  function handleOpen(v: boolean) {
    if (v) {
      setTeacher("")
      setSubject("")
      setDate(format(new Date(), "yyyy-MM-dd"))
      setTime("14:00")
      setModality("PRESENCIAL")
      setDuration(60)
      setIsDuo(false)
      setDuoIds([])
      setIsRecurring(false)
      setOccurrences(4)
      setAlreadyAgreed(false)
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

    // Série recorrente: nada é gravado aqui. Abre a revisão, que verifica a
    // agenda de todas as ocorrências e deixa ajustar só as exceções. Vale
    // também para a aula em grupo — os alunos entram como participantes da
    // mesma aula, e cada ocorrência desconta do pacote de todos.
    if (isRecurring) {
      setRecurringParams({
        teacherId,
        studentIds: isDuo ? [studentId, ...duoIds] : [studentId],
        subjectId, modality, duration,
        slots: weeklySlots(date, time, occurrences),
      })
      return
    }

    start(async () => {
      try {
        if (isDuo) {
          ouFalhe(await createDuoLessonAction({
            teacherId,
            subjectId,
            studentIds: [studentId, ...duoIds],
            date,
            time,
            modality,
            duration,
          }))
          toast.success("Aula em grupo (pacote) agendada com sucesso")
        } else {
          ouFalhe(await createLessonDirectAction({
            teacherId, studentId, subjectId, date, time, modality, duration, alreadyAgreed,
          }))
          toast.success(alreadyAgreed
            ? "Aula confirmada — professor avisado"
            : "Aula agendada com sucesso")
        }
        setOpen(false)
        router.push(`/colaborador/alunos/${studentId}`)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao agendar aula"))
      }
    })
  }

  /** A série já foi revisada e criada pelo modal de exceções. */
  function handleRecurringCreated(r: { created: number; conflicts: { date: string; reason: string }[] }) {
    setRecurringParams(null)
    setOpen(false)
    router.refresh()

    const n = `${r.created} aula${r.created !== 1 ? "s" : ""}`
    if (r.conflicts.length > 0) {
      // Alguém ocupou o horário entre a revisão e a confirmação
      setConflicts(r.conflicts)
      toast.warning(`${n} criada${r.created !== 1 ? "s" : ""}, mas ${r.conflicts.length} horário${r.conflicts.length !== 1 ? "s ficaram" : " ficou"} indisponível no meio do caminho`)
    } else {
      toast.success(`Série recorrente criada: ${n}`)
    }
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

            {/* Matéria + professor, filtrando um pelo outro */}
            <TeacherSubjectPicker
              teachers={teachers}
              teacherId={teacherId}
              subjectId={subjectId}
              onChange={handlePickerChange}
              labelClassName="text-xs font-medium"
              selectClassName="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

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

            {/* Duração (quantas aulas do pacote esta sessão consome) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Duração</Label>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10))}
                className={`flex h-9 w-full rounded-lg border px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                  duration === 30
                    ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
                    : duration > 60
                    ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900"
                    : "bg-background text-foreground border-input"
                }`}
              >
                <option value="30"  className="bg-background text-foreground">0,5 aula (30 min)</option>
                <option value="60"  className="bg-background text-foreground">1 aula (60 min)</option>
                <option value="90"  className="bg-background text-foreground">1,5 aula (90 min)</option>
                <option value="120" className="bg-background text-foreground">2 aulas (120 min)</option>
                <option value="150" className="bg-background text-foreground">2,5 aulas (150 min)</option>
                <option value="180" className="bg-background text-foreground">3 aulas (180 min)</option>
                <option value="210" className="bg-background text-foreground">3,5 aulas (210 min)</option>
                <option value="240" className="bg-background text-foreground">4 aulas (240 min)</option>
              </select>
              {duration !== 60 && (
                <p className="text-[11px] text-muted-foreground">
                  {isRecurring
                    ? `Cada ocorrência desconta ${fmtAulas(duration)} do pacote.`
                    : `Esta aula desconta ${fmtAulas(duration)} do pacote.`}
                </p>
              )}
            </div>

            {/* Já acertado com o responsável (só faz sentido na aula única) */}
            {!isDuo && !isRecurring && (
              <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={alreadyAgreed}
                  onChange={e => setAlreadyAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#219EBC]"
                />
                <span className="text-xs leading-snug">
                  <span className="font-medium">Já combinei com o responsável</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    A aula já entra como <strong>Confirmada</strong> e o aviso vai só para o
                    professor — sem mandar mensagem automática para quem você acabou de falar.
                  </span>
                </span>
              </label>
            )}

            {/* Recorrência semanal — vale também para a aula em grupo */}
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
                    1 aula por semana, sempre {date ? format(new Date(`${date}T00:00:00`), "EEEE", { locale: ptBRLocale }) : "no mesmo dia"} às {time}.
                    Desconta {fmtAulas(duration)} {isDuo ? "do pacote de cada aluno" : "do pacote"} por ocorrência.
                    Você verá a agenda de todas as datas antes de confirmar.
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !teacherId || !subjectId}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isRecurring ? "Revisar série" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revisão da série: conflitos por data, com ajuste das exceções */}
      <RecurringPreviewDialog
        params={recurringParams}
        label={
          isDuo && duoIds.length > 0
            ? [studentName, ...duoIds.map(id => otherStudents.find(s => s.id === id)?.name ?? "")]
                .map(n => n.split(" ")[0]).filter(Boolean).join(" + ")
            : studentName
        }
        onClose={() => setRecurringParams(null)}
        onCreated={handleRecurringCreated}
      />

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
            As demais aulas da série foram criadas normalmente. Estes horários ficaram
            ocupados entre a revisão e a confirmação — reagende-os manualmente:
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
