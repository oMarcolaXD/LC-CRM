"use client"

import { useTransition } from "react"
import { Button }        from "@/components/ui/button"
import { markPaymentPaidAction, markPaymentOverdueAction } from "@/lib/actions/financeiro"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export function PaymentActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition()

  if (status === "PAID") return null

  return (
    <div className="flex gap-1">
      {status === "PENDING" && (
        <Button size="sm" variant="ghost"
          className="text-orange-600 hover:bg-orange-50 text-xs px-2"
          disabled={pending}
          onClick={() => start(() => markPaymentOverdueAction(id) as unknown as void)}>
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3 mr-1" />}
          Vencido
        </Button>
      )}
      <Button size="sm"
        className="text-xs px-2"
        disabled={pending}
        onClick={() => start(() => markPaymentPaidAction(id) as unknown as void)}>
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
        Pago
      </Button>
    </div>
  )
}
