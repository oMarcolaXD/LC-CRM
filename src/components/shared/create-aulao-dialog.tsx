"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }  from "@/components/ui/button"
import { Badge }   from "@/components/ui/badge"
import { createAulaoAction } from "@/lib/actions/lesson-request"
import { toast }   from "sonner"
import {
  Users, Loader2, MapPin, Wifi, Building2, Home, X, BookOpen,
} from "lucide-react"
import { format } from "date-fns"

interface StudentOption { id: string; name: string }
interface TeacherOption {
  id:           string
  name:         string
  teachingMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjects:     { id: string; name: string }[]
}

export interface AulaoCreatedPayload {
  id:         string
  teacherId:  string
  subjectId:  string
  title:      string
  date:       string // yyyy-MM-dd
  time:       string // HH:mm
  duration:   number
  modality:   "PRESENCIAL" | "ONLINE"
  capacity:   number | null
  studentIds: string[]
  recurring:  boolean
}

interface Props {
  open:        boolean
  onClose:     () => void
  students:    StudentOption[]
  teachers:    TeacherOption[]
  defaultDate?:      string
  defaultTeacherId?: string
  defaultTime?:      string
  /** Chamado logo após a criação, com os dados do aulão-base (para inserção otimista no grid). */
  onCreated?:  (aulao: AulaoCreatedPayload) => void
}

export function CreateAulaoDialog({ open, onClose, students, teachers, defaultDate, defaultTeacherId, defaultTime, onCreated }: Props) {
  const today = defaultDate ?? format(new Date(), "yyyy-MM-dd")

  const [title,            setTitle]            = useState("")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [teacherId,        setTeacherId]        = useState(defaultTeacherId ?? "")
  const [subjectId,        setSubjectId]        = useState("")
  const [date,             setDate]             = useState(today)
  const [time,             setTime]             = useState(defaultTime ?? "09:00")
  const [duration,         setDuration]         = useState(90)
  const [modality,         setModality]         = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [teacherOnsite,    setTeacherOnsite]    = useState(false)
  const [capacity,         setCapacity]         = useState("")
  const [isFree,           setIsFree]           = useState(true)
  const [pricePerStudent,  setPricePerStudent]  = useState("")
  const [recurrence,       setRecurrence]       = useState<"" | "WEEKLY" | "BIWEEKLY" | "MONTHLY">("")
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState("")
  const [pending, start]   = useTransition()

  const teacher        = teachers.find(t => t.id === teacherId)
  const isOnlineOnly   = teacher?.teachingMode === "ONLINE_ONLY"
  const showLocToggle  = modality === "ONLINE" && teacher && !isOnlineOnly
  const capacityNum    = parseInt(capacity, 10) || undefined
  const maxStudents    = capacityNum ?? 50

  function toggleStudent(id: string) {
    setSelectedStudentIds(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : prev.length < maxStudents ? [...prev, id] : prev
    )
  }

  function handleTeacherChange(id: string) {
    setTeacherId(id)
    setSubjectId("")
    if (teachers.find(t => t.id === id)?.teachingMode === "ONLINE_ONLY") {
      setModality("ONLINE")
    }
  }

  function handleClose() {
    setTitle("")
    setSelectedStudentIds([])
    setTeacherId("")
    setSubjectId("")
    setDate(today)
    setTime("09:00")
    setDuration(90)
    setModality("PRESENCIAL")
    setTeacherOnsite(false)
    setCapacity("")
    setIsFree(true)
    setPricePerStudent("")
    setRecurrence("")
    setRecurrenceEndsAt("")
    onClose()
  }

  function submit() {
    if (!title.trim()) { toast.error("Informe um título para o aulão"); return }
    if (!teacherId || !subjectId) { toast.error("Selecione professor e matéria"); return }
    if (!isFree) {
      const price = parseFloat(pricePerStudent.replace(",", "."))
      if (isNaN(price) || price <= 0) { toast.error("Informe um valor válido por aluno"); return }
    }
    if (recurrence && !recurrenceEndsAt) { toast.error("Informe a data final da recorrência"); return }
    if (recurrence && recurrenceEndsAt <= date) { toast.error("A data final deve ser posterior à data do aulão"); return }

    start(async () => {
      try {
        const result = await createAulaoAction({
          teacherId,
          subjectId,
          title:           title.trim(),
          date,
          time,
          duration,
          modality,
          capacity:        capacityNum,
          isFree,
          pricePerStudent: isFree ? undefined : parseFloat(pricePerStudent.replace(",", ".")),
          studentIds:      selectedStudentIds,
          teacherOnsite:   modality === "ONLINE" ? teacherOnsite : undefined,
          recurrence:      recurrence ? { rule: recurrence, endsAt: recurrenceEndsAt } : undefined,
        })
        toast.success("Aulão criado com sucesso")
        if (result?.id) {
          onCreated?.({
            id:         result.id,
            teacherId,
            subjectId,
            title:      title.trim(),
            date,
            time,
            duration,
            modality,
            capacity:   capacityNum ?? null,
            studentIds: selectedStudentIds,
            recurring:  !!recurrence,
          })
        }
        handleClose()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar aulão")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-600" />
            Criar Aulão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-medium">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="ex: Revisão ENEM – Matemática"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Professor */}
          <div>
            <label className="text-xs font-medium">Professor <span className="text-destructive">*</span></label>
            <select
              value={teacherId}
              onChange={e => handleTeacherChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecionar professor...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Matéria */}
          <div>
            <label className="text-xs font-medium">Matéria <span className="text-destructive">*</span></label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              disabled={!teacher?.subjects?.length}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">Selecionar matéria...</option>
              {(teacher?.subjects ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Data, Hora e Duração */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Data <span className="text-destructive">*</span></label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium">Horário <span className="text-destructive">*</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium">Duração (min)</label>
              <input type="number" min={30} max={240} step={15} value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10) || 90)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Recorrência */}
          <div>
            <label className="text-xs font-medium">Recorrência</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {(["", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const).map(rule => (
                <button
                  key={rule}
                  type="button"
                  onClick={() => setRecurrence(rule)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    recurrence === rule
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                  }`}
                >
                  {rule === "" ? "Nenhuma" : rule === "WEEKLY" ? "Semanal" : rule === "BIWEEKLY" ? "Quinzenal" : "Mensal"}
                </button>
              ))}
            </div>
          </div>

          {/* Data final da recorrência */}
          {recurrence && (
            <div>
              <label className="text-xs font-medium">
                Repetir até <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={recurrenceEndsAt}
                min={date}
                onChange={e => setRecurrenceEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Capacidade */}
          <div>
            <label className="text-xs font-medium">Capacidade máxima (opcional)</label>
            <input
              type="number"
              min={1}
              max={200}
              placeholder="ex: 18"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
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
                <button type="button" onClick={() => setModality("PRESENCIAL")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "PRESENCIAL" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
                <button type="button" onClick={() => setModality("ONLINE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "ONLINE" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Wifi className="w-3.5 h-3.5" /> Online
                </button>
              </div>
            )}
          </div>

          {/* Localização do professor */}
          {showLocToggle && (
            <div>
              <label className="text-xs font-medium">Local do professor</label>
              <div className="mt-1 flex rounded-lg border border-input overflow-hidden">
                <button type="button" onClick={() => setTeacherOnsite(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    !teacherOnsite ? "bg-muted text-foreground font-medium" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Home className="w-3.5 h-3.5" /> Em casa
                </button>
                <button type="button" onClick={() => setTeacherOnsite(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    teacherOnsite ? "bg-amber-100 text-amber-800 font-medium" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Building2 className="w-3.5 h-3.5" /> Na sede
                </button>
              </div>
            </div>
          )}

          {/* Gratuito toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-input bg-muted/20">
            <div>
              <p className="text-sm font-medium">Aulão gratuito</p>
              <p className="text-xs text-muted-foreground">Não cobra nenhum pacote ou valor dos alunos</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFree(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${isFree ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isFree ? "translate-x-4" : ""}`} />
            </button>
          </div>

          {/* Valor por aluno (se não for gratuito) */}
          {!isFree && (
            <div>
              <label className="text-xs font-medium">
                Valor por aluno (R$) <span className="text-destructive">*</span>
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={pricePerStudent} onChange={e => setPricePerStudent(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Alunos (opcional) */}
          <div>
            <label className="text-xs font-medium">
              Alunos (opcional)
              <span className="text-muted-foreground ml-1">
                ({selectedStudentIds.length} selecionado{selectedStudentIds.length !== 1 ? "s" : ""}
                {capacityNum ? ` / ${capacityNum}` : ""})
              </span>
            </label>

            {selectedStudentIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                {selectedStudentIds.map(id => {
                  const name = students.find(s => s.id === id)?.name ?? id
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => toggleStudent(id)}>
                      {name}<X className="w-3 h-3" />
                    </Badge>
                  )
                })}
              </div>
            )}

            <div className="max-h-36 overflow-y-auto rounded-lg border border-input bg-background divide-y">
              {students.map(s => {
                const selected = selectedStudentIds.includes(s.id)
                const disabled = !selected && selectedStudentIds.length >= maxStudents
                return (
                  <button key={s.id} type="button" disabled={disabled} onClick={() => toggleStudent(s.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selected ? "bg-primary/10 text-primary font-medium"
                      : disabled ? "text-muted-foreground/40 cursor-not-allowed"
                      : "hover:bg-muted/50"
                    }`}>
                    {s.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {pending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
              : <><Users className="w-4 h-4 mr-2" /> Criar Aulão</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
