"use client"

// Ações de uma cobrança na listagem.
//
// Não existe mais botão "Vencido": a situação passou a ser derivada da data
// (ver src/lib/payments.ts), então marcar à mão deixou de fazer sentido — era
// justamente o passo que ninguém dava e que escondia a inadimplência.
//
// Quitar exige a forma de pagamento. Quando a cobrança já tem uma, o botão
// quita direto; quando não tem, ele abre o seletor antes, porque sem o método
// a taxa da maquininha fica em zero e a receita líquida sai inflada.

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { markPaymentPaidAction, deletePaymentAction } from "@/lib/actions/financeiro"
import { PAYMENT_METHODS, temMetodo } from "@/lib/payments"
import { ouFalhe } from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"
import { CheckCircle2, Loader2, Trash2, X } from "lucide-react"

export function PaymentActions({
  id, status, method,
}: {
  id: string
  status: string
  method: string | null
}) {
  const [pending, start] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const [pedindoMetodo, setPedindoMetodo] = useState(false)

  function quitar(forma?: string) {
    start(async () => {
      try {
        ouFalhe(await markPaymentPaidAction(id, forma))
        setPedindoMetodo(false)
        toast.success("Cobrança quitada")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao quitar"))
      }
    })
  }

  if (pedindoMetodo) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className="text-[11px] text-muted-foreground">Recebido em:</span>
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => quitar(m)}
            className="rounded-md border border-border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted disabled:opacity-50"
          >
            {m}
          </button>
        ))}
        <Button
          size="sm" variant="ghost"
          className="px-1.5 text-muted-foreground"
          disabled={pending}
          onClick={() => setPedindoMetodo(false)}
          title="Cancelar"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {status !== "PAID" && (
        <Button
          size="sm"
          className="px-2 text-xs"
          disabled={pending}
          onClick={() => (temMetodo(method) ? quitar() : setPedindoMetodo(true))}
        >
          {pending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="mr-1 h-3 w-3" />}
          Pago
        </Button>
      )}

      {confirmDel ? (
        <>
          <Button
            size="sm" variant="ghost"
            className="px-2 text-xs text-muted-foreground"
            disabled={pending}
            onClick={() => setConfirmDel(false)}
          >
            Não
          </Button>
          <Button
            size="sm" variant="ghost"
            className="px-2 text-xs text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() => {
              setConfirmDel(false)
              start(() => deletePaymentAction(id) as unknown as void)
            }}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Excluir"}
          </Button>
        </>
      ) : (
        <Button
          size="sm" variant="ghost"
          className="px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => setConfirmDel(true)}
          title="Excluir cobrança"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
