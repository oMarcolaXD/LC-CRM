"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { format }                  from "date-fns"
import { Plus, Loader2, CalendarDays, Wifi, MapPin } from "lucide-react"
import { Button }                  from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { toast }  from "sonner"
import { createLessonDirectAction } from "@/lib/actions/lesson-request"

interface Teacher {
  id:       string
  name:     string
  subjects: { id: string; name: string }[]
}

interface Props {
  studentId:   string
  studentName: string
  teachers:    Teacher[]
}

export function ScheduleLessonDialog({ studentId, studentName, teachers }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [teacherId, setTeacher] = useState("")
  const [subjectId, setSubject] = useState("")
  const [date, setDate]         = useState(format(new Date(), "yyyy-MM-dd"))
  const [time, setTime]         = useState("14:00")
  const [modality, setModality] = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [pending, start]        = useTransition()

  const selectedTeacher = teachers.find(t => t.id === teacherId)
  const subjects        = selectedTeacher?.subjects ?? []

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
    }
    setOpen(v)
  }

  function submit() {
    if (!teacherId || !subjectId || !date || !time) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    start(async () => {
      try {
        await createLessonDirectAction({ teacherId, studentId, subjectId, date, time, modality })
        toast.success("Aula agendada com sucesso")
        setOpen(false)
        router.push(`/colaborador/alunos/${studentId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao agendar aula")
      }
    })
  }

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => handleOpen(true)}>
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
            {/* Professor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Professor *</Label>
              <Select value={teacherId} onValueChange={(v) => handleTeacherChange(v ?? "")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar professor" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Matéria */}
            <div className="space-y-1.5">
              <Label className="text-xs">Matéria *</Label>
              <Select value={subjectId} onValueChange={(v) => setSubject(v ?? "")} disabled={!teacherId || subjects.length === 0}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={teacherId ? "Selecionar matéria" : "Selecione um professor primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !teacherId || !subjectId}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
