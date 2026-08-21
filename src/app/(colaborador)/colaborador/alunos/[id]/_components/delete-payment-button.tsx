"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deletePaymentAction } from "@/lib/actions/financeiro"
import { Trash2, Loader2 } from "lucide-react"
import { mensagemDeErro } from "@/lib/error-message"

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1"
        >
          Não
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirm(false)
            start(async () => {
              try {
                await deletePaymentAction(paymentId)
                router.refresh()
              } catch (e) {
                toast.error(mensagemDeErro(e, "Erro ao excluir pagamento"))
              }
            })
          }}
          className="text-[10px] font-medium text-destructive hover:underline disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      disabled={pending}
      title="Excluir pagamento"
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="w-3 h-3" />
    </button>
  )
}
