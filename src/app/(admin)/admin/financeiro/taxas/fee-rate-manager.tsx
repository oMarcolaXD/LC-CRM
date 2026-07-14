"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast }     from "sonner"
import {
  createFeeRateAction, updateFeeRateAction, deleteFeeRateAction,
} from "@/lib/actions/financeiro"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, Loader2, Percent } from "lucide-react"

interface Rate {
  id:              string
  method:          string
  minInstallments: number
  maxInstallments: number
  percent:         number
  fixed:           number
  active:          boolean
}

// Métodos que costumam ter taxa. Casam com Payment.method usado nos modais.
const METHODS = ["Cartão de crédito", "Cartão de débito", "Boleto", "Pix", "TED", "Transferência"]

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function FeeRateManager({ rates }: { rates: Rate[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Rate | null>(null)
  const [open, setOpen]       = useState(false)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(r: Rate) {
    setEditing(r)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nova taxa
        </Button>
      </div>

      {rates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma taxa configurada. Adicione as taxas da sua maquininha para acompanhar a receita líquida.
        </p>
      ) : (
        <div className="space-y-2">
          {rates.map((r) => (
            <div key={r.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {r.method}
                  {!r.active && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.minInstallments === r.maxInstallments
                    ? `${r.minInstallments}x`
                    : `${r.minInstallments}–${r.maxInstallments}x`}
                  {" · "}
                  {r.percent > 0 && `${r.percent.toFixed(2).replace(".", ",")}%`}
                  {r.percent > 0 && r.fixed > 0 && " + "}
                  {r.fixed > 0 && `${brl(r.fixed)} fixo`}
                  {r.percent === 0 && r.fixed === 0 && "sem taxa"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => openEdit(r)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <DeleteButton id={r.id} onDone={() => router.refresh()} />
              </div>
            </div>
          ))}
        </div>
      )}

      <FeeRateDialog
        key={editing?.id ?? "new"}
        open={open}
        onClose={() => setOpen(false)}
        rate={editing}
        onSaved={() => { setOpen(false); router.refresh() }}
      />
    </div>
  )
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        title="Excluir">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )
  }
  return (
    <button type="button" disabled={pending}
      onClick={() => start(async () => {
        try {
          await deleteFeeRateAction(id)
          toast.success("Taxa excluída")
          onDone()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao excluir")
        }
      })}
      className="h-8 px-2 flex items-center justify-center rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirmar"}
    </button>
  )
}

function FeeRateDialog({
  open, onClose, rate, onSaved,
}: {
  open: boolean; onClose: () => void; rate: Rate | null; onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const [method,  setMethod]  = useState(rate?.method ?? "Cartão de crédito")
  const [minI,    setMinI]    = useState(String(rate?.minInstallments ?? 1))
  const [maxI,    setMaxI]    = useState(String(rate?.maxInstallments ?? 1))
  const [percent, setPercent] = useState(String(rate?.percent ?? ""))
  const [fixed,   setFixed]   = useState(String(rate?.fixed ?? ""))
  const [active,  setActive]  = useState(rate?.active ?? true)

  function submit() {
    const payload = {
      method,
      minInstallments: parseInt(minI) || 1,
      maxInstallments: parseInt(maxI) || 1,
      percent:         parseFloat((percent || "0").replace(",", ".")) || 0,
      fixed:           parseFloat((fixed || "0").replace(",", ".")) || 0,
      active,
    }
    if (payload.maxInstallments < payload.minInstallments) {
      toast.error("Nº máximo de parcelas deve ser ≥ mínimo"); return
    }
    start(async () => {
      try {
        if (rate) await updateFeeRateAction({ id: rate.id, ...payload })
        else      await createFeeRateAction(payload)
        toast.success(rate ? "Taxa atualizada" : "Taxa criada")
        onSaved()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sub flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            {rate ? "Editar Taxa" : "Nova Taxa"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Método *</Label>
            <Select value={method} onValueChange={(v) => setMethod(v ?? "Cartão de crédito")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>{(v: unknown) => String(v ?? "Selecione")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Parcelas — de</Label>
              <Input type="number" min={1} max={24} value={minI}
                onChange={(e) => setMinI(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Parcelas — até</Label>
              <Input type="number" min={1} max={24} value={maxI}
                onChange={(e) => setMaxI(e.target.value)} className="h-9" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Para pagamento à vista/único, use 1 até 1.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa (%)</Label>
              <Input type="number" min={0} step="0.01" value={percent}
                onChange={(e) => setPercent(e.target.value)} placeholder="4,99" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fixo (R$)</Label>
              <Input type="number" min={0} step="0.01" value={fixed}
                onChange={(e) => setFixed(e.target.value)} placeholder="3,50" className="h-9" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary" />
            Regra ativa
          </label>
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
