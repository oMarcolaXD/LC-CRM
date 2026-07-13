"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updatePaymentStatusAction } from "@/lib/actions/colaborador"

interface Props {
  paymentId: string
  currentStatus: "PAID" | "PENDING" | "OVERDUE"
}

export function PaymentStatusSelector({ paymentId, currentStatus }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function handleStatusChange(status: "PAID" | "PENDING" | "OVERDUE") {
    start(async () => {
      try {
        await updatePaymentStatusAction(paymentId, status)
        toast.success("Status do pagamento atualizado")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar status do pagamento")
      }
    })
  }

  // Classes de estilo para cada status
  const classes = {
    PAID:    "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
    PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900",
    OVERDUE: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  }

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={e => handleStatusChange(e.target.value as "PAID" | "PENDING" | "OVERDUE")}
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50 ${classes[currentStatus]}`}
    >
      <option value="PENDING" className="bg-background text-foreground text-xs font-normal">Pendente</option>
      <option value="PAID" className="bg-background text-foreground text-xs font-normal">Paga</option>
      <option value="OVERDUE" className="bg-background text-foreground text-xs font-normal">Vencida</option>
    </select>
  )
}
