"use client"

import { useState, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { updatePaymentAction, deletePaymentAction } from "@/lib/actions/financeiro"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Label }   from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Pencil, Loader2, Trash2, AlertTriangle } from "lucide-react"

interface Props {
  payment: {
    id:          string
    amount:      number
    dueDate:     string   // "yyyy-MM-dd"
    paidAt:      string | null  // "yyyy-MM-dd"
    description: string | null
    method:      string | null
    status:      "PENDING" | "PAID" | "OVERDUE"
  }
  studentName: string
}

const METHODS = ["PIX", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto"]

export function EditPaymentDialog({ payment, studentName }: Props) {
  const router = useRouter()
  const [open,       setOpen]      = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [pending,    start]        = useTransition()

  const [amount,      setAmount]      = useState(String(payment.amount))
  const [dueDate,     setDueDate]     = useState(payment.dueDate)
  const [paidAt,      setPaidAt]      = useState(payment.paidAt ?? "")
  const [description, setDescription] = useState(payment.description ?? "")
  const [method,      setMethod]      = useState(payment.method ?? "")
  const [status,      setStatus]      = useState(payment.status)

  function handleOpen(v: boolean) {
    if (v) {
      setAmount(String(payment.amount))
      setDueDate(payment.dueDate)
      setPaidAt(payment.paidAt ?? "")
      setDescription(payment.description ?? "")
      setMethod(payment.method ?? "")
      setStatus(payment.status)
      setConfirmDel(false)
    }
    setOpen(v)
  }

  function submitEdit() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt < 0) { toast.error("Valor inválido"); return }
    if (!dueDate)               { toast.error("Informe o vencimento"); return }

    start(async () => {
      try {
        await updatePaymentAction({
          id:          payment.id,
          amount:      amt,
          dueDate,
          description: description || undefined,
          method:      method      || undefined,
          status,
          paidAt:      paidAt      || undefined,
        })
        toast.success("Cobrança atualizada")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar cobrança")
      }
    })
  }

  function submitDelete() {
    start(async () => {
      try {
        await deletePaymentAction(payment.id)
        toast.success("Cobrança excluída")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir cobrança")
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(true)}
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
        title="Editar cobrança"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar Cobrança — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue>
                    {(v: unknown) => (v === "PAID" ? "Pago" : v === "OVERDUE" ? "Vencido" : "Pendente")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === "PAID" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Data do pagamento</Label>
                <Input
                  type="date"
                  value={paidAt}
                  onChange={e => setPaidAt(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Método <span className="text-muted-foreground">(opcional)</span></Label>
              <Select value={method} onValueChange={v => setMethod(v ?? "")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue>
                    {(v: unknown) => (v ? String(v) : "Não definido")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Não definido</SelectItem>
                  {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Pacote 8 aulas — Maio/2025"
                className="h-9"
              />
            </div>

            {/* Zona de perigo */}
            <div className="border-t pt-4 space-y-3">
              {!confirmDel ? (
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir cobrança
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-xs">Isso é irreversível. A cobrança será permanentemente excluída.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDel(false)}
                      className="flex-1 h-8 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={submitDelete}
                      disabled={pending}
                      className="flex-1 h-8 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {pending ? "Excluindo…" : "Confirmar exclusão"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={pending}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
