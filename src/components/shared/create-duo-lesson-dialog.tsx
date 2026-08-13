"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { createDuoLessonAction } from "@/lib/actions/lesson-request"
import { toast }    from "sonner"
import { Users, Loader2, MapPin, Wifi, Building2, Home, X, Repeat } from "lucide-react"
import { format }   from "date-fns"
import { ptBR as ptBRLocale } from "date-fns/locale"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"
import { weeklySlots } from "@/lib/recurrence"
import { RecurringPreviewDialog, type RecurringParams } from "@/components/shared/recurring-preview-dialog"
import { TeacherSubjectPicker } from "@/components/shared/teacher-subject-picker"

interface StudentOption { id: string; name: string; remainingLessons?: number }
interface TeacherOption {
  id:           string
  name:         string
  teachingMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjects:     { id: string; name: string }[]
}

interface Props {
  open:      boolean
  onClose:   () => void
  students:  StudentOption[]
  teachers:  TeacherOption[]
  /** Data pré-selecionada no formato "yyyy-MM-dd" */
  defaultDate?:      string
  defaultTeacherId?: string
  defaultTime?:      string
}

export function CreateDuoLessonDialog({ open, onClose, students, teachers, defaultDate, defaultTeacherId, defaultTime }: Props) {
  const today = defaultDate ?? format(new Date(), "yyyy-MM-dd")

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [teacherId,   setTeacherId]   = useState(defaultTeacherId ?? "")
  const [subjectId,   setSubjectId]   = useState("")
  const [date,        setDate]        = useState(today)
  const [time,        setTime]        = useState(defaultTime ?? "09:00")
  const [modality,    setModality]    = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [teacherOnsite, setTeacherOnsite] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [occurrences, setOccurrences] = useState(4)
  const [recurringParams, setRecurringParams] = useState<RecurringParams | null>(null)
  const [pending, start] = useTransition()

  const teacher     = teachers.find(t => t.id === teacherId)
  const isOnlineOnly = teacher?.teachingMode === "ONLINE_ONLY"
  const showLocationToggle = modality === "ONLINE" && teacher && !isOnlineOnly

  function toggleStudent(id: string) {
    setSelectedStudentIds(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : prev.length < 4 ? [...prev, id] : prev
    )
  }

  function handlePickerChange(next: { teacherId: string; subjectId: string }) {
    setTeacherId(next.teacherId)
    setSubjectId(next.subjectId)
    if (teachers.find(t => t.id === next.teacherId)?.teachingMode === "ONLINE_ONLY") {
      setModality("ONLINE")
    }
  }

  function handleClose() {
    setSelectedStudentIds([])
    setTeacherId(defaultTeacherId ?? "")
    setSubjectId("")
    setDate(today)
    setTime(defaultTime ?? "09:00")
    setModality("PRESENCIAL")
    setTeacherOnsite(false)
    setIsRecurring(false)
    setOccurrences(4)
    onClose()
  }

  function submit() {
    if (selectedStudentIds.length < 2) {
      toast.error("Selecione pelo menos 2 alunos")
      return
    }
    if (!teacherId || !subjectId) {
      toast.error("Selecione professor e matéria")
      return
    }

    // Série recorrente: a revisão confere a agenda de todas as datas e o saldo
    // de cada aluno antes de gravar qualquer coisa.
    if (isRecurring) {
      setRecurringParams({
        teacherId,
        studentIds: selectedStudentIds,
        subjectId,
        modality,
        duration:   60,
        slots:      weeklySlots(date, time, occurrences),
      })
      return
    }

    start(async () => {
      try {
        ouFalhe(await createDuoLessonAction({
          teacherId,
          subjectId,
          studentIds: selectedStudentIds,
          date,
          time,
          modality,
          teacherOnsite: modality === "ONLINE" ? teacherOnsite : undefined,
        }))
        toast.success(`Aula em grupo (pacote) criada para ${selectedStudentIds.length} alunos`)
        handleClose()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao criar aula em grupo"))
      }
    })
  }

  const selectedStudentNames = selectedStudentIds
    .map(id => students.find(s => s.id === id)?.name)
    .filter(Boolean)

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Aula em Grupo (pacote)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cada aluno terá <strong>1 aula descontada do seu pacote</strong> (2 a 4 alunos).
          </p>

          {/* Alunos selecionados */}
          {selectedStudentNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedStudentIds.map(id => {
                const name = students.find(s => s.id === id)?.name ?? id
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-destructive/10"
                    onClick={() => toggleStudent(id)}
                  >
                    {name}
                    <X className="w-3 h-3" />
                  </Badge>
                )
              })}
            </div>
          )}

          {/* Seletor de alunos */}
          <div>
            <label className="text-xs font-medium">
              Alunos <span className="text-destructive">*</span>
              <span className="text-muted-foreground ml-1">
                ({selectedStudentIds.length}/4 selecionados — mín. 2)
              </span>
            </label>
            <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-input bg-background divide-y">
              {students.map(s => {
                const selected = selectedStudentIds.includes(s.id)
                const disabled = !selected && selectedStudentIds.length >= 4
                const noBalance = s.remainingLessons !== undefined && s.remainingLessons <= 0
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleStudent(s.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                      selected
                        ? "bg-primary/10 text-primary font-medium"
                        : disabled
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.remainingLessons !== undefined && (
                      <span className={`text-[11px] shrink-0 ${noBalance ? "text-destructive" : "text-muted-foreground"}`}>
                        {noBalance
                          ? "sem saldo"
                          : `${s.remainingLessons} aula${s.remainingLessons !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Matéria + professor, filtrando um pelo outro */}
          <TeacherSubjectPicker
            teachers={teachers}
            teacherId={teacherId}
            subjectId={subjectId}
            onChange={handlePickerChange}
          />

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">
                Data <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Horário <span className="text-destructive">*</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Modalidade */}
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
                  <MapPin className="w-3.5 h-3.5" /> Presencial
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
                  <Wifi className="w-3.5 h-3.5" /> Online
                </button>
              </div>
            )}
          </div>

          {/* Localização do professor */}
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
                  <Home className="w-3.5 h-3.5" /> Em casa
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
                  <Building2 className="w-3.5 h-3.5" /> Na sede
                </button>
              </div>
            </div>
          )}

          {/* Recorrência semanal */}
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
                  1 aula por semana, sempre {date ? format(new Date(`${date}T00:00:00`), "EEEE", { locale: ptBRLocale }) : "no mesmo dia"} às {time},
                  descontando 1 aula do pacote de cada aluno por ocorrência.
                  Você verá a agenda de todas as datas antes de confirmar.
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-xs whitespace-nowrap">Quantas semanas</label>
                  <input
                    type="number" min={2} max={52} value={occurrences}
                    onChange={e => setOccurrences(Math.max(2, Math.min(52, parseInt(e.target.value, 10) || 2)))}
                    className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
              : isRecurring
              ? <><Repeat className="w-4 h-4 mr-2" /> Revisar série</>
              : <><Users className="w-4 h-4 mr-2" /> Criar Aula em Grupo (pacote)</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Revisão da série antes de gravar */}
      <RecurringPreviewDialog
        params={recurringParams}
        label={selectedStudentNames.map(n => String(n).split(" ")[0]).join(" + ")}
        onClose={() => setRecurringParams(null)}
        onCreated={(r) => {
          setRecurringParams(null)
          const n = `${r.created} aula${r.created !== 1 ? "s" : ""}`
          if (r.conflicts.length > 0) {
            toast.warning(`${n} criada${r.created !== 1 ? "s" : ""}, mas ${r.conflicts.length} horário(s) ficaram indisponíveis no meio do caminho`)
          } else {
            toast.success(`Série recorrente criada: ${n}`)
          }
          handleClose()
        }}
      />
    </>
  )
}
