"use client"

import { useTransition }                    from "react"
import { Button, buttonVariants }           from "@/components/ui/button"
import { markPaymentPaidColaboradorAction } from "@/lib/actions/colaborador"
import { CheckCircle2, Loader2, FileText }  from "lucide-react"
import Link                                 from "next/link"
import { toast }                            from "sonner"
import { mensagemDeErro } from "@/lib/error-message"

interface PaymentActionsProps {
  id:     string
  status: "PENDING" | "PAID" | "OVERDUE"
}

export function PaymentActions({ id, status }: PaymentActionsProps) {
  const [pending, startTransition] = useTransition()

  function handlePaid() {
    startTransition(async () => {
      try {
        await markPaymentPaidColaboradorAction(id)
        toast.success("Pagamento marcado como pago")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao atualizar pagamento"))
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {(status === "PENDING" || status === "OVERDUE") && (
        <Button
          size="sm" variant="outline" disabled={pending}
          className="text-green-700 border-green-300 hover:bg-green-50 h-8 text-xs px-2"
          onClick={handlePaid}
        >
          {pending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <CheckCircle2 className="w-3 h-3 mr-1" />
          }
          Marcar Pago
        </Button>
      )}
      {status === "PAID" && (
        <Link
          href={`/colaborador/financeiro/recibo/${id}`}
          className={buttonVariants({ variant: "outline", size: "sm" }) + " h-8 text-xs px-2"}
        >
          <FileText className="w-3 h-3 mr-1" />
          Recibo
        </Link>
      )}
    </div>
  )
}
