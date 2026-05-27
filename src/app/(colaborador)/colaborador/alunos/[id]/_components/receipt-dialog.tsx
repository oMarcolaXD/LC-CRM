"use client"

import { useState, useEffect } from "react"
import { FileText } from "lucide-react"
import { format } from "date-fns"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"

interface Payment {
  id:          string
  amount:      number
  dueDate:     string  // ISO
  paidAt:      string | null  // ISO
  method:      string | null
  description: string | null
  status:      string
}

interface Props {
  studentId:     string
  payments:      Payment[]
  guardianName:  string | null
  guardianPhone: string | null
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy")
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", TED: "TED", BOLETO: "Boleto",
}

export function ReceiptDialog({ studentId, payments, guardianName }: Props) {
  const [open, setOpen] = useState(false)

  const paidPayments = payments.filter(p => p.status === "PAID")

  const [paymentId, setPaymentId] = useState(paidPayments[0]?.id ?? "")
  const [name,      setName]      = useState(guardianName ?? "")
  const [cpf,       setCpf]       = useState("")
  const [date,      setDate]      = useState("")
  const [desc,      setDesc]      = useState("")

  const selected = paidPayments.find(p => p.id === paymentId) ?? null

  useEffect(() => {
    if (!selected) return
    const d = selected.paidAt ?? selected.dueDate
    setDate(d.slice(0, 10))
    const method = selected.method ? (METHOD_LABEL[selected.method] ?? selected.method) : null
    setDesc(selected.description || (method ? `Aulas particulares (pago via ${method})` : "Aulas particulares"))
  }, [paymentId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpen(v: boolean) {
    if (v) {
      const first = paidPayments[0]
      setPaymentId(first?.id ?? "")
      setName(guardianName ?? "")
      setCpf("")
      if (first) {
        const d = first.paidAt ?? first.dueDate
        setDate(d.slice(0, 10))
        const method = first.method ? (METHOD_LABEL[first.method] ?? first.method) : null
        setDesc(first.description || (method ? `Aulas particulares (pago via ${method})` : "Aulas particulares"))
      } else {
        setDate(new Date().toISOString().slice(0, 10))
        setDesc("Aulas particulares")
      }
    }
    setOpen(v)
  }

  function generate() {
    if (!paymentId || !cpf || !name || !date) return
    const params = new URLSearchParams({
      paymentId,
      cpf:  cpf,
      name: name,
      date: date,
      desc: desc,
    })
    window.open(`/colaborador/alunos/${studentId}/recibo?${params.toString()}`, "_blank")
    setOpen(false)
  }

  const canGenerate = !!paymentId && cpf.replace(/\D/g, "").length === 11 && !!name.trim() && !!date

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
        className="gap-1.5 h-8 text-xs"
      >
        <FileText className="w-3.5 h-3.5" />
        Recibo
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Gerar Recibo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Pagamento */}
            <div className="space-y-1.5">
              <Label className="text-xs">Pagamento *</Label>
              {paidPayments.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                  Nenhum pagamento pago registrado para este aluno.
                </p>
              ) : (
                <select
                  value={paymentId}
                  onChange={e => setPaymentId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {paidPayments.map(p => {
                    const method = p.method ? ` · ${METHOD_LABEL[p.method] ?? p.method}` : ""
                    const d = p.paidAt ?? p.dueDate
                    return (
                      <option key={p.id} value={p.id}>
                        {brl(p.amount)} — {fmtDate(d)}{method}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>

            {/* Nome do contratante */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do contratante *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome completo do responsável"
                className="h-9"
              />
            </div>

            {/* CPF */}
            <div className="space-y-1.5">
              <Label className="text-xs">CPF do contratante *</Label>
              <Input
                value={cpf}
                onChange={e => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                O CPF não é armazenado no sistema (LGPD).
              </p>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data do recibo *</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição dos serviços</Label>
              <Input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Ex: Aulas particulares (pago via Pix)"
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={!canGenerate || paidPayments.length === 0}>
              <FileText className="w-4 h-4 mr-2" />
              Gerar Recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
