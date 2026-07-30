"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { rescheduleAndApproveRequestAction } from "@/lib/actions/lesson-request"
import { MapPin, Wifi, Home, Building2, Loader2 } from "lucide-react"
import { toast }   from "sonner"
import { format }  from "date-fns"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

type TeacherMode = "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"

interface RescheduleDialogProps {
  open:            boolean
  onOpenChange:    (open: boolean) => void
  requestId:       string
  originalAt:      Date
  teacherMode:     TeacherMode
  requestModality: "PRESENCIAL" | "ONLINE"
}

export function RescheduleDialog({
  open, onOpenChange, requestId, originalAt, teacherMode, requestModality,
}: RescheduleDialogProps) {
  const [pending, startTransition] = useTransition()
  const [date, setDate] = useState(format(originalAt, "yyyy-MM-dd"))
  const [time, setTime] = useState(format(originalAt, "HH:mm"))
  const [modality, setModality] = useState<"PRESENCIAL" | "ONLINE">(
    teacherMode === "ONLINE_ONLY" ? "ONLINE" : requestModality
  )
  const [teacherOnsite, setTeacherOnsite] = useState(false)

  const canSetPresencial   = teacherMode !== "ONLINE_ONLY"
  const showLocationToggle = modality === "ONLINE" && canSetPresencial

  function handleConfirm() {
    if (!date || !time) return
    startTransition(async () => {
      try {
        ouFalhe(await rescheduleAndApproveRequestAction(
          requestId, date, time, modality,
          showLocationToggle ? teacherOnsite : undefined,
        ))
        toast.success("Aula reagendada e aprovada")
        onOpenChange(false)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao reagendar"))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sub text-base">Reagendar e Aprovar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horário</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {canSetPresencial && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modalidade</Label>
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setModality("PRESENCIAL")}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 transition-colors ${
                    modality === "PRESENCIAL"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <MapPin className="w-3 h-3" /> Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setModality("ONLINE")}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 transition-colors ${
                    modality === "ONLINE"
                      ? "bg-brand-blue text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Wifi className="w-3 h-3" /> Online
                </button>
              </div>
            </div>
          )}

          {showLocationToggle && (
            <div className="space-y-1.5">
              <Label className="text-xs">Localização do professor</Label>
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setTeacherOnsite(false)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 transition-colors ${
                    !teacherOnsite
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Home className="w-3 h-3" /> Em casa
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherOnsite(true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 transition-colors ${
                    teacherOnsite
                      ? "bg-amber-100 text-amber-800 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Building2 className="w-3 h-3" /> Na sede
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={pending || !date || !time}>
            {pending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Confirmar reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
