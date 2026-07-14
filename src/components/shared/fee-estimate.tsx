"use client"

import { useEffect, useState } from "react"
import { getActiveFeeRatesAction } from "@/lib/actions/financeiro"
import { calcTotalFee, type FeeRate } from "@/lib/fees"
import { Percent } from "lucide-react"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Cache em módulo: as regras mudam raramente; evita refetch a cada abertura de modal.
let cache: FeeRate[] | null = null

/**
 * Mostra a taxa de cartão estimada e o valor líquido de uma cobrança, com base
 * nas regras configuradas em /admin/financeiro/taxas. Não renderiza nada quando
 * não há taxa aplicável (ex: dinheiro/pix sem regra).
 */
export function FeeEstimate({
  method, amount, installmentTotal = 1,
}: {
  method: string | null | undefined
  amount: number
  installmentTotal?: number
}) {
  const [rates, setRates] = useState<FeeRate[]>(cache ?? [])

  useEffect(() => {
    if (cache) return
    getActiveFeeRatesAction().then((r) => { cache = r; setRates(r) }).catch(() => {})
  }, [])

  if (!amount || amount <= 0) return null
  const fee = calcTotalFee(rates, method, installmentTotal, amount)
  if (fee <= 0) return null

  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
      <Percent className="w-3.5 h-3.5 shrink-0" />
      <span>
        Taxa estimada: <strong>{brl(fee)}</strong> · Líquido: <strong>{brl(amount - fee)}</strong>
      </span>
    </div>
  )
}
