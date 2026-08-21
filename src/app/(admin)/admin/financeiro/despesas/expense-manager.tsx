"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Plus, Pencil, Trash2, Loader2, Repeat, Check, Undo2, Receipt,
} from "lucide-react"

import {
  createExpenseAction, updateExpenseAction, deleteExpenseAction,
  deleteExpenseSeriesAction, setExpensePaidAction,
} from "@/lib/actions/despesas"
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from "@/lib/expenses"
import { brl } from "@/lib/reports/format"
import { ouFalhe } from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { ExpenseCategory, ExpenseRecurrence } from "@prisma/client"

export interface ExpenseRow {
  id:                string
  description:       string
  category:          ExpenseCategory
  amount:            number
  competencia:       string          // ISO
  paidAt:            string | null   // ISO
  recurrence:        ExpenseRecurrence
  recurrenceGroupId: string | null
  notes:             string | null
}

export function ExpenseManager({
  expenses, defaultYear,
}: {
  expenses: ExpenseRow[]
  defaultYear: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [open, setOpen]       = useState(false)

  // Agrupa por mês de competência, do mais recente para o mais antigo.
  const byMonth = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>()
    for (const e of expenses) {
      const key = e.competencia.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [expenses])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus className="mr-1 h-4 w-4" /> Nova despesa
        </Button>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma despesa lançada em {defaultYear}.</p>
          <p className="max-w-md text-xs text-muted-foreground/70">
            Lance aluguel, marketing, software e impostos aqui. Enquanto isso, o relatório
            mostra apenas a margem depois dos professores — não o lucro real.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {byMonth.map(([key, rows]) => {
            const total = rows.reduce((s, e) => s + e.amount, 0)
            const monthLabel = format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR })
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                    {monthLabel}
                  </span>
                  <span
                    className="font-mono text-[12.5px] font-semibold"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {brl(total)}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((e) => (
                    <ExpenseLine
                      key={e.id}
                      expense={e}
                      onEdit={() => { setEditing(e); setOpen(true) }}
                      onDone={() => router.refresh()}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ExpenseDialog
        key={editing?.id ?? "new"}
        open={open}
        expense={editing}
        defaultYear={defaultYear}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); router.refresh() }}
      />
    </div>
  )
}

// ─── Linha ────────────────────────────────────────────────────────────────────

function ExpenseLine({
  expense: e, onEdit, onDone,
}: {
  expense: ExpenseRow; onEdit: () => void; onDone: () => void
}) {
  const [pending, start] = useTransition()
  const paid = !!e.paidAt

  function togglePaid() {
    start(async () => {
      try {
        ouFalhe(await setExpensePaidAction(e.id, !paid))
        toast.success(paid ? "Marcada como em aberto" : "Marcada como paga")
        onDone()
      } catch (err) {
        toast.error(mensagemDeErro(err, "Erro ao atualizar"))
      }
    })
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
          {e.description}
          {e.recurrenceGroupId && (
            <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Despesa recorrente" />
          )}
        </p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          {EXPENSE_CATEGORY_LABEL[e.category]}
          {paid
            ? ` · pago em ${format(parseISO(e.paidAt!), "dd/MM/yyyy")}`
            : " · em aberto"}
          {e.notes ? ` · ${e.notes}` : ""}
        </p>
      </div>

      <span
        className="shrink-0 font-mono text-[13px] font-semibold"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {brl(e.amount)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={togglePaid}
          disabled={pending}
          title={paid ? "Marcar como em aberto" : "Marcar como paga"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-50",
            paid
              ? "border-[var(--success)]/30 text-[var(--success)]"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {pending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : paid ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <DeleteExpenseButton expense={e} onDone={onDone} />
      </div>
    </div>
  )
}

function DeleteExpenseButton({ expense: e, onDone }: { expense: ExpenseRow; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const isSeries = !!e.recurrenceGroupId

  function run(series: boolean) {
    start(async () => {
      try {
        const n = series
          ? ouFalhe(await deleteExpenseSeriesAction(e.id))
          : (ouFalhe(await deleteExpenseAction(e.id)), 1)
        toast.success(series ? `${n} lançamento(s) excluído(s)` : "Despesa excluída")
        onDone()
      } catch (err) {
        toast.error(mensagemDeErro(err, "Erro ao excluir"))
      }
    })
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        title="Excluir"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(false)}
        className="h-7 rounded-lg bg-destructive px-2 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Só esta
      </button>
      {isSeries && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(true)}
          className="h-7 rounded-lg bg-destructive px-2 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Esta e futuras
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirm(false)}
        className="h-7 rounded-lg border border-border px-2 text-[11px] font-medium text-muted-foreground"
      >
        Cancelar
      </button>
    </div>
  )
}

// ─── Diálogo ──────────────────────────────────────────────────────────────────

function ExpenseDialog({
  open, expense, defaultYear, onClose, onSaved,
}: {
  open: boolean
  expense: ExpenseRow | null
  defaultYear: number
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, start] = useTransition()

  const today = new Date()
  const defaultCompetencia = expense
    ? expense.competencia.slice(0, 7)
    : `${defaultYear}-${String(
        defaultYear === today.getFullYear() ? today.getMonth() + 1 : 1,
      ).padStart(2, "0")}`

  const [description, setDescription] = useState(expense?.description ?? "")
  const [category,    setCategory]    = useState<ExpenseCategory>(expense?.category ?? "ALUGUEL")
  const [amount,      setAmount]      = useState(expense ? String(expense.amount) : "")
  const [competencia, setCompetencia] = useState(defaultCompetencia)
  const [paidAt,      setPaidAt]      = useState(expense?.paidAt?.slice(0, 10) ?? "")
  const [recurrence,  setRecurrence]  = useState<ExpenseRecurrence>(expense?.recurrence ?? "UNICA")
  const [months,      setMonths]      = useState("12")
  const [notes,       setNotes]       = useState(expense?.notes ?? "")

  function submit() {
    const payload = {
      description,
      category,
      amount:      parseFloat((amount || "0").replace(",", ".")),
      competencia,
      paidAt:      paidAt || null,
      recurrence,
      months:      recurrence === "MENSAL" ? parseInt(months) || 12 : undefined,
      notes:       notes || null,
    }

    start(async () => {
      try {
        if (expense) {
          ouFalhe(await updateExpenseAction(expense.id, payload))
          toast.success("Despesa atualizada")
        } else {
          const n = ouFalhe(await createExpenseAction(payload))
          toast.success(n > 1 ? `${n} lançamentos criados` : "Despesa lançada")
        }
        onSaved()
      } catch (err) {
        toast.error(mensagemDeErro(err, "Erro ao salvar"))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sub">
            <Receipt className="h-4 w-4 text-primary" />
            {expense ? "Editar Despesa" : "Nova Despesa"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aluguel da sede"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria *</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory((v as ExpenseCategory) ?? "OUTROS")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue>
                    {(v: unknown) => EXPENSE_CATEGORY_LABEL[v as ExpenseCategory] ?? "Selecione"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input
                type="number" min={0} step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500,00"
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mês de competência *</Label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pago em</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
            A competência define em qual mês a despesa pesa no lucro. A data de pagamento
            define em qual mês ela sai do caixa. Deixe em branco se ainda não pagou.
          </p>

          {!expense && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Repetição</Label>
                <div className="flex gap-2">
                  {(["UNICA", "MENSAL"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors",
                        recurrence === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r === "UNICA" ? "Única" : "Todo mês"}
                    </button>
                  ))}
                </div>
              </div>

              {recurrence === "MENSAL" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Por quantos meses?</Label>
                  <Input
                    type="number" min={1} max={60}
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Cria um lançamento por mês a partir da competência escolhida. Depois dá
                    para editar ou excluir cada mês separadamente.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending || !description || !amount}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
