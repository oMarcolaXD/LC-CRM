"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { addStudentPaymentAction } from "@/lib/actions/colaborador"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { FeeEstimate } from "@/components/shared/fee-estimate"
import { Plus, Loader2, RotateCcw } from "lucide-react"

type PaymentStatus = "PAID" | "PENDING" | "OVERDUE"

const STATUS_OPTIONS: { value: PaymentStatus; label: string; cls: string }[] = [
  { value: "PAID",    label: "Pago",     cls: "bg-green-100 text-green-700 border-green-400" },
  { value: "PENDING", label: "Pendente", cls: "bg-yellow-100 text-yellow-700 border-yellow-400" },
  { value: "OVERDUE", label: "Vencido",  cls: "bg-red-100 text-red-700 border-red-400" },
]

const METHOD_OPTIONS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "TED", "Boleto"]

// Métodos que permitem parcelamento (uma cobrança por parcela)
const INSTALLMENT_METHODS = ["Cartão de crédito", "Boleto"]

type Installment = { dueDate: string; amount: string }

// Distribui o total em N parcelas mensais a partir da 1ª data.
// A última parcela absorve o arredondamento para fechar o total exato.
function buildInstallments(total: number, count: number, firstDate: string): Installment[] {
  const base = Math.floor((total / count) * 100) / 100
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${firstDate}T00:00:00`)
    d.setMonth(d.getMonth() + i)
    const value = i === count - 1
      ? Math.round((total - base * (count - 1)) * 100) / 100
      : base
    return { dueDate: d.toISOString().slice(0, 10), amount: value.toFixed(2) }
  })
}

interface AddPaymentDialogProps {
  studentId: string
}

export function AddPaymentDialog({ studentId }: AddPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const today = new Date().toISOString().slice(0, 10)

  const [amount,      setAmount]      = useState("")
  const [dueDate,     setDueDate]     = useState(today)
  const [status,      setStatus]      = useState<PaymentStatus>("PAID")
  const [paidAt,      setPaidAt]      = useState(today)
  const [method,      setMethod]      = useState("Pix")
  const [description, setDescription] = useState("")

  const [installmentCount, setInstallmentCount] = useState(1)
  const [installments,     setInstallments]     = useState<Installment[]>([])

  const canInstall    = INSTALLMENT_METHODS.includes(method)
  const isInstallment = canInstall && installmentCount > 1

  function reset() {
    setAmount(""); setDueDate(today); setStatus("PAID")
    setPaidAt(today); setMethod("Pix"); setDescription("")
    setInstallmentCount(1); setInstallments([])
  }

  function handleOpen(v: boolean) {
    if (v) reset()
    setOpen(v)
  }

  // Ao trocar de método sem parcelamento, zera as parcelas.
  useEffect(() => {
    if (!canInstall) { setInstallmentCount(1); setInstallments([]) }
  }, [canInstall])

  // (Re)gera as parcelas ao mudar a quantidade.
  useEffect(() => {
    if (!canInstall || installmentCount <= 1) { setInstallments([]); return }
    const total = parseFloat(amount.replace(",", ".")) || 0
    setInstallments(buildInstallments(total, installmentCount, dueDate))
    // Intencional: só regenera ao mudar a quantidade de parcelas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installmentCount, canInstall])

  function recalcInstallments() {
    const total = parseFloat(amount.replace(",", ".")) || 0
    setInstallments(buildInstallments(total, installmentCount, dueDate))
  }

  function updateInstallment(i: number, field: keyof Installment, value: string) {
    setInstallments(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const installmentsTotal = installments.reduce(
    (sum, r) => sum + (parseFloat(r.amount.replace(",", ".")) || 0), 0,
  )

  function submit() {
    const amountNum = parseFloat(amount.replace(",", "."))
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Informe um valor válido")
      return
    }
    if (!dueDate) {
      toast.error("Informe a data de vencimento")
      return
    }

    // Modo parcelado
    if (isInstallment) {
      const parsed = installments.map(r => ({
        dueDate: r.dueDate,
        amount:  parseFloat(r.amount.replace(",", ".")),
      }))
      if (parsed.some(p => !p.dueDate)) {
        toast.error("Informe a data de todas as parcelas")
        return
      }
      if (parsed.some(p => isNaN(p.amount) || p.amount <= 0)) {
        toast.error("Informe um valor válido para todas as parcelas")
        return
      }
      start(async () => {
        try {
          await addStudentPaymentAction({
            studentId,
            amount:       amountNum,
            dueDate:      parsed[0].dueDate,
            status:       "PENDING",
            method:       method || undefined,
            description:  description || undefined,
            installments: parsed,
          })
          toast.success(`${parsed.length} parcelas registradas com sucesso`)
          setOpen(false)
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao registrar parcelas")
        }
      })
      return
    }

    // Modo cobrança única
    start(async () => {
      try {
        await addStudentPaymentAction({
          studentId,
          amount:      amountNum,
          dueDate,
          paidAt:      status === "PAID" ? paidAt || dueDate : undefined,
          status,
          method:      method || undefined,
          description: description || undefined,
        })
        toast.success("Pagamento registrado com sucesso")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao registrar pagamento")
      }
    })
  }

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
        className="gap-1.5 h-8 text-xs"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar pagamento
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] overflow-x-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Adicionar Pagamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status (oculto no modo parcelado — parcelas nascem pendentes) */}
            {!isInstallment && (
              <div>
                <Label className="mb-2 block">Status *</Label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        status === opt.value
                          ? opt.cls
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Método */}
            <div className="space-y-1.5">
              <Label>Método</Label>
              <div className="flex flex-wrap gap-2">
                {METHOD_OPTIONS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                      method === m
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label>{isInstallment ? "Valor total (R$) *" : "Valor (R$) *"}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Nº de parcelas (só boleto / cartão de crédito) */}
            {canInstall && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallmentCount(n)}
                      className={`w-9 h-8 rounded-lg border text-xs font-medium transition-colors ${
                        installmentCount === n
                          ? "bg-secondary text-white border-secondary"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vencimento (cobrança única) */}
            {!isInstallment && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vencimento *</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>

                {status === "PAID" && (
                  <div className="space-y-1.5">
                    <Label>Pago em</Label>
                    <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {/* Editor de parcelas */}
            {isInstallment && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Datas e valores das parcelas</Label>
                  <button
                    type="button"
                    onClick={recalcInstallments}
                    className="flex items-center gap-1 text-[11px] text-secondary hover:underline"
                    title="Redistribuir a partir do valor total e mensal"
                  >
                    <RotateCcw className="w-3 h-3" /> Recalcular
                  </button>
                </div>

                <div className="space-y-2">
                  {installments.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-xs text-muted-foreground">{i + 1}/{installmentCount}</span>
                      <Input
                        type="date"
                        value={row.dueDate}
                        onChange={e => updateInstallment(i, "dueDate", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={e => updateInstallment(i, "amount", e.target.value)}
                        className="h-8 w-24 text-xs"
                        placeholder="0,00"
                      />
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground text-right">
                  Soma das parcelas: <strong>{brl(installmentsTotal)}</strong>
                </p>
              </div>
            )}

            {/* Taxa de cartão estimada */}
            <FeeEstimate
              method={method}
              amount={parseFloat(amount.replace(",", ".")) || 0}
              installmentTotal={isInstallment ? installmentCount : 1}
            />

            {/* Referente a */}
            <div className="space-y-1.5">
              <Label>Referente a</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Pacote de 10 aulas — maio/2024"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || !amount || !dueDate}>
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                : <><Plus className="w-4 h-4 mr-2" /> {isInstallment ? "Registrar parcelas" : "Registrar"}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
