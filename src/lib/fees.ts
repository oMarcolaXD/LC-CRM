// Cálculo de taxas de cartão/maquininha.
//
// As regras (CardFeeRate) são configuradas pelo admin em /admin/financeiro/taxas,
// por método de pagamento + faixa de nº de parcelas. Este módulo é puro (sem I/O),
// então serve tanto nas server actions quanto nos modais (client): o servidor
// converte os campos Decimal do Prisma em number antes de passar para o cliente.

/** Regra de taxa em formato simples (number), pronta para uso no cliente. */
export interface FeeRate {
  method:          string
  minInstallments: number
  maxInstallments: number
  percent:         number  // ex: 4.99  (%)
  fixed:           number  // ex: 3.50  (R$)
  active:          boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Acha a regra ativa que casa com o método e a faixa de parcelas. */
export function matchRate(
  rates: FeeRate[],
  method: string | null | undefined,
  installmentTotal: number,
): FeeRate | undefined {
  if (!method) return undefined
  const m = method.trim().toLowerCase()
  const n = Math.max(1, installmentTotal || 1)
  return rates.find(
    (r) =>
      r.active &&
      r.method.trim().toLowerCase() === m &&
      n >= r.minInstallments &&
      n <= r.maxInstallments,
  )
}

/**
 * Taxa desta parcela específica.
 *
 * `amount` é o valor DESTA parcela e `installmentTotal` o nº total de parcelas do
 * grupo. O valor fixo (ex: boleto) é rateado entre as parcelas para que o somatório
 * do grupo bata com a taxa real da transação. Sem regra casada → 0.
 */
export function calcFee(
  rates: FeeRate[],
  method: string | null | undefined,
  installmentTotal: number,
  amount: number,
): number {
  const rate = matchRate(rates, method, installmentTotal)
  if (!rate) return 0
  const total = Math.max(1, installmentTotal || 1)
  const fee = amount * (rate.percent / 100) + rate.fixed / total
  return round2(fee)
}

/**
 * Taxa total da transação inteira (valor cheio + valor fixo uma única vez).
 * Igual ao somatório de `calcFee` sobre todas as parcelas. Use para exibir a
 * taxa/líquido do total nos modais. `totalAmount` é o valor cheio da transação.
 */
export function calcTotalFee(
  rates: FeeRate[],
  method: string | null | undefined,
  installmentTotal: number,
  totalAmount: number,
): number {
  const rate = matchRate(rates, method, installmentTotal)
  if (!rate) return 0
  return round2(totalAmount * (rate.percent / 100) + rate.fixed)
}
