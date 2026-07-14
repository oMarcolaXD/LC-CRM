"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast }     from "sonner"
import { setPayoutPaidAction, updateTeacherPayWindowAction } from "@/lib/actions/financeiro"
import { Badge }  from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { CheckCircle2, Loader2, RotateCcw, CalendarClock } from "lucide-react"

interface Row {
  teacherId:         string
  name:              string
  hourlyRate:        number
  payDayStart:       number | null
  payDayEnd:         number | null
  month:             number
  year:              number
  status:            "PAID" | "PENDING"
  paidAt:            string | null
  totalLessonsLabel: string
  totalAmountLabel:  string
  totalAmount:       number
}

export function PayoutRow({ row }: { row: Row }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [winOpen, setWinOpen] = useState(false)

  function togglePaid(paid: boolean) {
    start(async () => {
      try {
        await setPayoutPaidAction(row.teacherId, row.month, row.year, paid)
        toast.success(paid ? "Repasse marcado como pago" : "Repasse reaberto")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar repasse")
      }
    })
  }

  const windowLabel = row.payDayStart != null
    ? `Paga dia ${row.payDayStart}${row.payDayEnd && row.payDayEnd !== row.payDayStart ? `–${row.payDayEnd}` : ""}`
    : "Sem dia definido"

  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.totalLessonsLabel} aulas · R$ {row.hourlyRate.toFixed(2).replace(".", ",")}/aula
        </p>
        <button type="button" onClick={() => setWinOpen(true)}
          className="text-xs text-secondary hover:underline inline-flex items-center gap-1 mt-0.5">
          <CalendarClock className="w-3 h-3" /> {windowLabel}
        </button>
        {row.paidAt && row.status === "PAID" && (
          <p className="text-xs text-green-600 mt-0.5">Pago em {row.paidAt}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-base font-bold">{row.totalAmountLabel}</p>
        <Badge variant={row.status === "PAID" ? "default" : "secondary"}>
          {row.status === "PAID" ? "Pago" : "Pendente"}
        </Badge>
        {row.status === "PAID" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => togglePaid(false)}>
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
            Reabrir
          </Button>
        ) : (
          <Button size="sm" disabled={pending || row.totalAmount <= 0} onClick={() => togglePaid(true)}>
            {pending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Marcar Pago
          </Button>
        )}
      </div>

      <PayWindowDialog
        open={winOpen}
        onClose={() => setWinOpen(false)}
        teacherId={row.teacherId}
        name={row.name}
        start={row.payDayStart}
        end={row.payDayEnd}
        onSaved={() => { setWinOpen(false); router.refresh() }}
      />
    </div>
  )
}

function PayWindowDialog({
  open, onClose, teacherId, name, start, end, onSaved,
}: {
  open: boolean; onClose: () => void; teacherId: string; name: string
  start: number | null; end: number | null; onSaved: () => void
}) {
  const [pending, run] = useTransition()
  const [s, setS] = useState(start != null ? String(start) : "")
  const [e, setE] = useState(end != null ? String(end) : "")

  function submit() {
    const sv = s ? parseInt(s) : null
    const ev = e ? parseInt(e) : (sv ?? null)
    if (sv != null && ev != null && ev < sv) {
      toast.error("Dia final deve ser ≥ inicial"); return
    }
    run(async () => {
      try {
        await updateTeacherPayWindowAction(teacherId, sv, ev)
        toast.success("Dia de pagamento atualizado")
        onSaved()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-sub flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Dia de pagamento — {name}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            Faixa de dias do mês em que este professor recebe o repasse (ex: entre o dia 5 e 10).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Do dia</Label>
              <Input type="number" min={1} max={31} value={s}
                onChange={(ev) => setS(ev.target.value)} placeholder="5" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até o dia</Label>
              <Input type="number" min={1} max={31} value={e}
                onChange={(ev) => setE(ev.target.value)} placeholder="10" className="h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
