"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }  from "@/components/ui/button"
import { createTeacherCommitmentAction } from "@/lib/actions/lesson-request"
import { toast }   from "sonner"
import { CalendarPlus, Loader2 } from "lucide-react"
import { format }  from "date-fns"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

interface TeacherOption { id: string; name: string }

interface Props {
  open:        boolean
  onClose:     () => void
  teachers:    TeacherOption[]
  defaultDate?: string
}

export function CreateCommitmentDialog({ open, onClose, teachers, defaultDate }: Props) {
  const today = defaultDate ?? format(new Date(), "yyyy-MM-dd")

  const [teacherId, setTeacherId] = useState("")
  const [title,     setTitle]     = useState("")
  const [date,      setDate]      = useState(today)
  const [time,      setTime]      = useState("09:00")
  const [duration,  setDuration]  = useState(60)
  const [pending, start] = useTransition()

  function handleClose() {
    setTeacherId("")
    setTitle("")
    setDate(today)
    setTime("09:00")
    setDuration(60)
    onClose()
  }

  function submit() {
    if (!teacherId) { toast.error("Selecione um professor"); return }
    if (!title.trim()) { toast.error("Informe uma descrição para o compromisso"); return }

    start(async () => {
      try {
        ouFalhe(await createTeacherCommitmentAction({ teacherId, title: title.trim(), date, time, duration }))
        toast.success("Compromisso registrado na agenda do professor")
        handleClose()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao registrar compromisso"))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" />
            Registrar Compromisso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Bloqueia o horário do professor na agenda sem criar uma aula ou cobrança.
          </p>

          {/* Professor */}
          <div>
            <label className="text-xs font-medium">Professor <span className="text-destructive">*</span></label>
            <select
              value={teacherId}
              onChange={e => setTeacherId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecionar professor...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-medium">Descrição <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="ex: Reunião pedagógica, Preparação de material..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium">Data <span className="text-destructive">*</span></label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium">Horário <span className="text-destructive">*</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Duração */}
          <div>
            <label className="text-xs font-medium">Duração (minutos)</label>
            <div className="mt-1 flex gap-2 flex-wrap">
              {[30, 60, 90, 120].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    duration === d ? "bg-primary text-white border-primary" : "border-input text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {d} min
                </button>
              ))}
              <input
                type="number" min={15} max={480} step={15} value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10) || 60)}
                className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
              : <><CalendarPlus className="w-4 h-4 mr-2" /> Registrar</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
