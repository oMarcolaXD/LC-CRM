"use client"

import { useState, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { createLessonDirectAction, createGroupLessonAction } from "@/lib/actions/lesson-request"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import {
  History, Loader2, CheckCircle2, XCircle, MonitorPlay, School,
  Users, Plus, Trash2, DollarSign,
} from "lucide-react"

interface Subject { id: string; name: string }
interface Teacher { id: string; name: string; subjects: Subject[] }
interface Student { id: string; name: string }

interface RegisterPastLessonDialogProps {
  studentId:   string
  teachers:    Teacher[]
  allStudents: Student[]
}

interface GroupEntry { studentId: string; price: string; paid: boolean }

export function RegisterPastLessonDialog({
  studentId,
  teachers,
  allStudents,
}: RegisterPastLessonDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const today = new Date().toISOString().slice(0, 10)

  const [date,      setDate]      = useState(today)
  const [time,      setTime]      = useState("08:00")
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "")
  const [subjectId, setSubjectId] = useState(teachers[0]?.subjects[0]?.id ?? "")
  const [duration,  setDuration]  = useState("60")
  const [modality,  setModality]  = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [topics,    setTopics]    = useState("")
  const [status,    setStatus]    = useState<"COMPLETED" | "MISSED">("COMPLETED")

  // Grupo
  const [isGroup,      setIsGroup]  = useState(false)
  const [price1,       setPrice1]   = useState("")
  const [paid1,        setPaid1]    = useState(false)
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([
    { studentId: allStudents.find(s => s.id !== studentId)?.id ?? "", price: "", paid: false },
  ])

  const otherStudents    = allStudents.filter(s => s.id !== studentId)
  const selectedTeacher  = teachers.find(t => t.id === teacherId)
  const availableSubjects = selectedTeacher?.subjects ?? []

  function handleTeacherChange(tid: string) {
    setTeacherId(tid)
    const t = teachers.find(x => x.id === tid)
    const subs = t?.subjects ?? []
    // keep current subject only if it's in the new teacher's list
    if (!subs.find(s => s.id === subjectId)) {
      setSubjectId(subs[0]?.id ?? "")
    }
  }

  function reset() {
    setDate(today); setTime("08:00")
    const firstTeacher = teachers[0]
    setTeacherId(firstTeacher?.id ?? "")
    setSubjectId(firstTeacher?.subjects[0]?.id ?? "")
    setDuration("60"); setModality("PRESENCIAL"); setTopics(""); setStatus("COMPLETED")
    setIsGroup(false); setPrice1(""); setPaid1(false)
    setGroupEntries([{ studentId: otherStudents[0]?.id ?? "", price: "", paid: false }])
  }

  function handleOpen(v: boolean) {
    if (v) reset()
    setOpen(v)
  }

  function addGroupEntry() {
    if (groupEntries.length >= 3) return
    setGroupEntries(prev => [...prev, { studentId: "", price: "", paid: false }])
  }

  function removeGroupEntry(i: number) {
    setGroupEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateGroupEntry(i: number, field: keyof GroupEntry, value: string | boolean) {
    setGroupEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function submit() {
    if (!date || !teacherId || !subjectId) {
      toast.error("Preencha data, professor e matéria")
      return
    }

    if (isGroup) {
      const p1 = parseFloat(price1)
      if (!price1 || p1 < 0) { toast.error("Informe o valor do aluno 1"); return }

      for (let i = 0; i < groupEntries.length; i++) {
        const entry = groupEntries[i]
        if (!entry.studentId) { toast.error(`Selecione o aluno ${i + 2}`); return }
        if (entry.studentId === studentId) { toast.error(`Aluno ${i + 2} deve ser diferente do aluno principal`); return }
        const p = parseFloat(entry.price)
        if (!entry.price || p < 0) { toast.error(`Informe o valor do aluno ${i + 2}`); return }
      }

      const allIds = [studentId, ...groupEntries.map(e => e.studentId)]
      if (new Set(allIds).size !== allIds.length) {
        toast.error("Há alunos duplicados na seleção")
        return
      }

      start(async () => {
        try {
          await createGroupLessonAction({
            teacherId,
            subjectId,
            studentIds:     allIds,
            date,
            time,
            modality,
            duration:       parseInt(duration) || 60,
            statusOverride: status,
            studentPrices: [
              { studentId, price: p1 },
              ...groupEntries.map(e => ({ studentId: e.studentId, price: parseFloat(e.price) })),
            ],
            studentPayments: [
              { studentId, paid: paid1 },
              ...groupEntries.map(e => ({ studentId: e.studentId, paid: e.paid })),
            ],
          })
          const n = allIds.length
          toast.success(status === "COMPLETED"
            ? `Aula em grupo (${n} alunos) registrada`
            : `Falta em grupo registrada`)
          setOpen(false)
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao registrar aula")
        }
      })
      return
    }

    start(async () => {
      try {
        await createLessonDirectAction({
          teacherId,
          studentId,
          subjectId,
          date,
          time,
          modality,
          duration:       parseInt(duration) || 60,
          statusOverride: status,
          topicsCovered:  topics || undefined,
        })
        toast.success(status === "COMPLETED" ? "Aula registrada como realizada" : "Falta registrada")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao registrar aula")
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
        className="gap-1.5 h-8 text-xs"
      >
        <History className="w-3.5 h-3.5" />
        Registrar aula
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Registrar Aula Passada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status */}
            <div className="flex gap-2">
              {(["COMPLETED", "MISSED"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    status === s
                      ? s === "COMPLETED"
                        ? "bg-green-100 text-green-700 border-green-400"
                        : "bg-red-100 text-red-700 border-red-400"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  }`}
                >
                  {s === "COMPLETED"
                    ? <><CheckCircle2 className="w-4 h-4" /> Realizada</>
                    : <><XCircle className="w-4 h-4" /> Faltou</>}
                </button>
              ))}
            </div>

            {/* Grupo toggle */}
            <button
              type="button"
              onClick={() => setIsGroup(v => !v)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isGroup
                  ? "bg-brand-blue/10 text-brand-blue border-brand-blue/40"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              <Users className="w-4 h-4" />
              {isGroup ? "Aula em grupo (ativado)" : "Aula em grupo"}
            </button>

            {/* Alunos do grupo + preços + pagamento */}
            {isGroup && (
              <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-3 space-y-3">
                {/* Aluno 1 — atual */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Aluno 1 (este aluno)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number" min={0} step="0.01"
                      value={price1}
                      onChange={e => setPrice1(e.target.value)}
                      placeholder="R$ valor"
                      className="h-9 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setPaid1(v => !v)}
                      className={`h-9 px-2.5 rounded-lg border text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors ${
                        paid1
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <DollarSign className="w-3 h-3" />
                      {paid1 ? "Pago" : "Pendente"}
                    </button>
                  </div>
                </div>

                {/* Alunos adicionais */}
                {groupEntries.map((entry, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Aluno {i + 2} *</Label>
                      {groupEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroupEntry(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={entry.studentId}
                        onChange={e => updateGroupEntry(i, "studentId", e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Selecione</option>
                        {otherStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <Input
                        type="number" min={0} step="0.01"
                        value={entry.price}
                        onChange={e => updateGroupEntry(i, "price", e.target.value)}
                        placeholder="R$ valor"
                        className="h-9 w-24 shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => updateGroupEntry(i, "paid", !entry.paid)}
                        className={`h-9 px-2.5 rounded-lg border text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors ${
                          entry.paid
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <DollarSign className="w-3 h-3" />
                        {entry.paid ? "Pago" : "Pend."}
                      </button>
                    </div>
                  </div>
                ))}

                {groupEntries.length < 3 && (
                  <button
                    type="button"
                    onClick={addGroupEntry}
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-brand-blue/40 text-xs text-brand-blue hover:bg-brand-blue/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar aluno
                  </button>
                )}
              </div>
            )}

            {/* Data e Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input
                  type="date" max={today}
                  value={date} onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            {/* Professor e Matéria */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Professor *</Label>
                <select
                  value={teacherId}
                  onChange={e => handleTeacherChange(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Matéria *</Label>
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={availableSubjects.length === 0}
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
                <Label>Duração (min)</Label>
                <Input
                  type="number" min={30} max={240} step={30}
                  value={duration} onChange={e => setDuration(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modalidade</Label>
                <div className="flex gap-2">
                  {(["PRESENCIAL", "ONLINE"] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModality(m)}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-medium transition-colors ${
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

            {/* Conteúdo (só para individual) */}
            {!isGroup && (
              <div className="space-y-1.5">
                <Label>Conteúdo abordado</Label>
                <Input
                  value={topics}
                  onChange={e => setTopics(e.target.value)}
                  placeholder="Ex: Funções do 2º grau, limite e derivada…"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !date || !teacherId || !subjectId}>
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                : <><History className="w-4 h-4 mr-2" /> Registrar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
