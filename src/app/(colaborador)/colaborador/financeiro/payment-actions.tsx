"use client"

// Quitar uma cobrança exige a forma de pagamento: sem ela a taxa da maquininha
// fica em zero e a receita líquida dos relatórios sai maior do que o valor que
// entrou. Quando a cobrança já tem forma, o botão quita direto; quando não tem,
// abre o seletor antes.

import { useState, useTransition }          from "react"
import { Button, buttonVariants }           from "@/components/ui/button"
import { markPaymentPaidColaboradorAction } from "@/lib/actions/colaborador"
import { PAYMENT_METHODS, temMetodo }       from "@/lib/payments"
import { CheckCircle2, Loader2, FileText, X } from "lucide-react"
import Link                                 from "next/link"
import { toast }                            from "sonner"
import { mensagemDeErro } from "@/lib/error-message"

interface PaymentActionsProps {
  id:     string
  status: "PENDING" | "PAID" | "OVERDUE"
  method: string | null
}

export function PaymentActions({ id, status, method }: PaymentActionsProps) {
  const [pending, startTransition] = useTransition()
  const [pedindoMetodo, setPedindoMetodo] = useState(false)

  function quitar(forma?: string) {
    startTransition(async () => {
      try {
        await markPaymentPaidColaboradorAction(id, forma)
        setPedindoMetodo(false)
        toast.success("Pagamento registrado")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao atualizar pagamento"))
      }
    })
  }

  if (pedindoMetodo) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
          size="sm" variant="ghost" className="h-8 px-1.5 text-muted-foreground"
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
    <div className="flex shrink-0 items-center gap-1.5">
      {status !== "PAID" && (
        <Button
          size="sm" variant="outline" disabled={pending}
          className="h-8 border-green-300 px-2 text-xs text-green-700 hover:bg-green-50"
          onClick={() => (temMetodo(method) ? quitar() : setPedindoMetodo(true))}
        >
          {pending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="mr-1 h-3 w-3" />}
          Marcar Pago
        </Button>
      )}
      {status === "PAID" && (
        <Link
          href={`/colaborador/financeiro/recibo/${id}`}
          className={buttonVariants({ variant: "outline", size: "sm" }) + " h-8 px-2 text-xs"}
        >
          <FileText className="mr-1 h-3 w-3" />
          Recibo
        </Link>
      )}
    </div>
  )
}
