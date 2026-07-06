"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { Plus, Loader2, BookOpen, RefreshCw } from "lucide-react"
import { Button }   from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast }    from "sonner"
import { createStudentPackageAction } from "@/lib/actions/financeiro"

interface Props {
  studentId:   string
  studentName: string
  mode:        "novo" | "renovar"
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const PAYMENT_METHODS = [
  { value: "PIX",             label: "PIX" },
  { value: "Cartão de crédito", label: "Cartão de crédito" },
  { value: "Cartão de débito",  label: "Cartão de débito" },
  { value: "Boleto",          label: "Boleto" },
  { value: "Dinheiro",        label: "Dinheiro" },
  { value: "Transferência",   label: "Transferência bancária" },
  { value: "Outro",           label: "Outro" },
]

export function PackageDialog({ studentId, studentName, mode }: Props) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  const [totalLessons, setTotal]    = useState("10")
  const [pricePerLesson, setPrice]  = useState("90")
  const [expiresInDays, setExpires] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(todayISO)

  const [isClosed, setIsClosed]     = useState(false)

  const [createPayment, setCreatePayment]   = useState(false)
  const [paymentAmount, setPaymentAmount]   = useState("")
  const [paymentDueDate, setPaymentDueDate] = useState(todayISO)
  const [paymentPaidAt, setPaymentPaidAt]   = useState("")
  const [paymentMethod, setPaymentMethod]   = useState("")

  const [pending, start] = useTransition()

  function handleOpen(v: boolean) {
    if (v) {
      setTotal("10")
      setPrice("90")
      setExpires("")
      setPurchaseDate(todayISO())
      setIsClosed(false)
      setCreatePayment(false)
      setPaymentAmount("")
      setPaymentDueDate(todayISO())
      setPaymentPaidAt("")
      setPaymentMethod("")
    }
    setOpen(v)
  }

  const totalValue = Number(totalLessons) * Number(pricePerLesson)

  function handleCreatePaymentToggle(checked: boolean) {
    setCreatePayment(checked)
    if (checked && !paymentAmount) {
      setPaymentAmount(totalValue.toFixed(2))
    }
    if (checked && !paymentDueDate) {
      setPaymentDueDate(purchaseDate || todayISO())
    }
  }

  function submit() {
    const total   = parseFloat(totalLessons)
    const price   = parseFloat(pricePerLesson)
    const expires = expiresInDays ? parseInt(expiresInDays, 10) : undefined

    if (!total || total < 0.5 || !Number.isInteger(total * 2)) { toast.error("Número de aulas inválido (use múltiplos de 0,5)"); return }
    if (!price || price < 0) { toast.error("Valor por aula inválido");  return }

    if (createPayment) {
      const amt = parseFloat(paymentAmount)
      if (!amt || amt < 0.01) { toast.error("Valor do pagamento inválido"); return }
      if (!paymentDueDate)    { toast.error("Data de vencimento obrigatória"); return }
    }

    start(async () => {
      try {
        await createStudentPackageAction({
          studentId,
          totalLessons:  total,
          pricePerLesson: price,
          expiresInDays:  expires,
          purchaseDate,
          isClosed,
          payment: createPayment ? {
            amount:  parseFloat(paymentAmount),
            dueDate: paymentDueDate,
            paidAt:  paymentPaidAt || undefined,
            method:  paymentMethod || undefined,
          } : undefined,
        })
        toast.success(mode === "renovar" ? "Pacote renovado com sucesso" : "Pacote criado com sucesso")
        setOpen(false)
        router.push(`/colaborador/alunos/${studentId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar pacote")
      }
    })
  }

  const isRenew = mode === "renovar"

  return (
    <>
      <Button
        size="sm"
        variant={isRenew ? "default" : "outline"}
        className="gap-1.5"
        onClick={() => handleOpen(true)}
      >
        {isRenew
          ? <><RefreshCw className="w-3.5 h-3.5" /> Renovar pacote</>
          : <><Plus className="w-3.5 h-3.5" /> Novo pacote</>
        }
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {isRenew ? "Renovar pacote" : "Novo pacote"} — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quantidade de aulas */}
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade de aulas *</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={totalLessons}
                onChange={e => setTotal(e.target.value)}
                placeholder="10"
                className="h-9"
              />
            </div>

            {/* Preço por aula */}
            <div className="space-y-1.5">
              <Label className="text-xs">Valor por aula (R$) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={pricePerLesson}
                onChange={e => setPrice(e.target.value)}
                placeholder="90.00"
                className="h-9"
              />
            </div>

            {/* Validade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Validade em dias <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={e => setExpires(e.target.value)}
                placeholder="Ex: 180 (deixe vazio para sem validade)"
                className="h-9"
              />
            </div>

            {/* Data de aquisição */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data de aquisição *</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={e => {
                  setPurchaseDate(e.target.value)
                  if (!paymentDueDate || paymentDueDate === purchaseDate) {
                    setPaymentDueDate(e.target.value)
                  }
                }}
                className="h-9"
              />
            </div>

            {/* Resumo */}
            {totalLessons && pricePerLesson && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                <p>
                  <strong className="text-foreground">{totalLessons} aulas</strong>
                  {" × "}
                  <strong className="text-foreground">R$ {Number(pricePerLesson).toFixed(2)}</strong>
                  {" = "}
                  <strong className="text-primary">
                    R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </strong>
                </p>
                {expiresInDays && (
                  <p>Vence em {expiresInDays} dias a partir da data de aquisição</p>
                )}
              </div>
            )}

            {/* ─── Pacote já encerrado ──────────────────────── */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isClosed"
                  checked={isClosed}
                  onCheckedChange={v => setIsClosed(Boolean(v))}
                />
                <Label htmlFor="isClosed" className="text-xs cursor-pointer">
                  Pacote já encerrado (todas as aulas já foram realizadas)
                </Label>
              </div>
              {isClosed && (
                <p className="text-xs text-muted-foreground mt-1.5 pl-6">
                  O pacote será registrado como <strong>Esgotado</strong> com 0 aulas restantes.
                </p>
              )}
            </div>

            {/* ─── Criar pagamento ─────────────────────────── */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="createPayment"
                  checked={createPayment}
                  onCheckedChange={v => handleCreatePaymentToggle(Boolean(v))}
                />
                <Label htmlFor="createPayment" className="text-xs cursor-pointer">
                  Criar registro de pagamento vinculado
                </Label>
              </div>

              {createPayment && (
                <div className="pl-6 space-y-3">
                  {/* Valor */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor do pagamento (R$) *</Label>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      placeholder={totalValue.toFixed(2)}
                      className="h-9"
                    />
                  </div>

                  {/* Data de vencimento */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de vencimento *</Label>
                    <Input
                      type="date"
                      value={paymentDueDate}
                      onChange={e => setPaymentDueDate(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Data de pagamento */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Data de pagamento <span className="text-muted-foreground">(deixe vazio se ainda pendente)</span>
                    </Label>
                    <Input
                      type="date"
                      value={paymentPaidAt}
                      onChange={e => setPaymentPaidAt(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Método */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Método de pagamento <span className="text-muted-foreground">(opcional)</span></Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue>
                          {(v: unknown) => PAYMENT_METHODS.find(m => m.value === v)?.label ?? "Selecione o método"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status resumido */}
                  <p className="text-xs text-muted-foreground">
                    Status: <strong className={paymentPaidAt ? "text-green-600" : "text-amber-600"}>
                      {paymentPaidAt ? "Pago" : "Pendente"}
                    </strong>
                    {paymentPaidAt && ` em ${new Date(paymentPaidAt + "T12:00:00").toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isRenew ? "Renovar" : "Criar pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
