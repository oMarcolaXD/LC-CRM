"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { createGroupLessonAction } from "@/lib/actions/lesson-request"
import { toast }    from "sonner"
import { Users, Loader2, MapPin, Wifi, Building2, Home, X, AlertCircle } from "lucide-react"
import { format }   from "date-fns"

interface StudentOption { id: string; name: string }
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

export function CreateGroupLessonDialog({ open, onClose, students, teachers, defaultDate, defaultTeacherId, defaultTime }: Props) {
  const today = defaultDate ?? format(new Date(), "yyyy-MM-dd")

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [teacherId,   setTeacherId]   = useState(defaultTeacherId ?? "")
  const [subjectId,   setSubjectId]   = useState("")
  const [date,        setDate]        = useState(today)
  const [time,        setTime]        = useState(defaultTime ?? "09:00")
  const [modality,    setModality]    = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [teacherOnsite, setTeacherOnsite] = useState(false)
  const [pricePerStudent, setPricePerStudent] = useState("")
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

  function handleTeacherChange(id: string) {
    setTeacherId(id)
    setSubjectId("")
    if (teachers.find(t => t.id === id)?.teachingMode === "ONLINE_ONLY") {
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
    setPricePerStudent("")
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
    const price = parseFloat(pricePerStudent.replace(",", "."))
    if (isNaN(price) || price <= 0) {
      toast.error("Informe um valor válido por aluno")
      return
    }

    start(async () => {
      try {
        await createGroupLessonAction({
          teacherId,
          subjectId,
          studentIds: selectedStudentIds,
          date,
          time,
          modality,
          pricePerStudent: price,
          teacherOnsite: modality === "ONLINE" ? teacherOnsite : undefined,
        })
        toast.success(`Aula em grupo criada para ${selectedStudentIds.length} alunos`)
        handleClose()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar aula em grupo")
      }
    })
  }

  const selectedStudentNames = selectedStudentIds
    .map(id => students.find(s => s.id === id)?.name)
    .filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Criar Aula em Grupo (avulso)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dica: grupo é cobrança avulsa, não usa o pacote */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Esta opção <strong>não desconta do pacote</strong> dos alunos — gera uma cobrança
              avulsa com o valor por aluno abaixo. Para descontar do pacote, use <strong>&ldquo;Grupo (pacote)&rdquo;</strong>.
            </span>
          </div>

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
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleStudent(s.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
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

          {/* Professor */}
          <div>
            <label className="text-xs font-medium">
              Professor <span className="text-destructive">*</span>
            </label>
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
            <label className="text-xs font-medium">
              Matéria <span className="text-destructive">*</span>
            </label>
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

          {/* Valor por aluno */}
          <div>
            <label className="text-xs font-medium">
              Valor por aluno (R$) <span className="text-destructive">*</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={pricePerStudent}
                onChange={e => setPricePerStudent(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {pricePerStudent && selectedStudentIds.length >= 2 && (
              <p className="text-xs text-muted-foreground mt-1">
                Total da sessão: R${" "}
                {(parseFloat(pricePerStudent.replace(",", ".")) * selectedStudentIds.length).toFixed(2).replace(".", ",")}
                {" "}({selectedStudentIds.length} alunos × R${parseFloat(pricePerStudent.replace(",", ".")).toFixed(2).replace(".", ",")})
              </p>
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
              : <><Users className="w-4 h-4 mr-2" /> Criar Aula em Grupo</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
