"use client"

import { useTransition } from "react"
import { Button }        from "@/components/ui/button"
import { markPayoutPaidAction } from "@/lib/actions/financeiro"
import { CheckCircle2, Loader2 } from "lucide-react"

export function PayoutActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition()
  if (status === "PAID") return null
  return (
    <Button size="sm" disabled={pending}
      onClick={() => start(() => markPayoutPaidAction(id) as unknown as void)}>
      {pending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
      Marcar Pago
    </Button>
  )
}
