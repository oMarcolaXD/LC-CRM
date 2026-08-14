// Formatação de números dos relatórios.
//
// Módulo puro (sem I/O, sem "use server") para poder ser importado tanto pelos
// Server Components das abas quanto pelos gráficos client.
//
// O resto do projeto redefine `brl()` localmente em cada página; aqui os
// relatórios usam um ponto único, porque os mesmos valores aparecem em tela,
// no CSV e na impressão e precisam sair idênticos nos três.

/** R$ 1.234,56 */
export function brl(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** R$ 1.235 — para KPIs e eixos, onde os centavos só poluem. */
export function brlRound(v: number): string {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  })
}

/** R$ 12,3 mil / R$ 1,2 mi — para eixos de gráfico. */
export function brlCompact(v: number): string {
  const abs  = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")} mi`
  if (abs >= 1_000)     return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(".", ",")} mil`
  return `${sign}R$ ${Math.round(abs)}`
}

/** 42,5% */
export function pct(v: number, decimals = 1): string {
  if (!Number.isFinite(v)) return "–"
  return `${v.toFixed(decimals).replace(".", ",")}%`
}

/** Fração 0–1 → "42%" */
export function ratioPct(v: number, decimals = 0): string {
  if (!Number.isFinite(v)) return "–"
  return pct(v * 100, decimals)
}

/** 8 · 8,5 — contagens de aula são Decimal(5,1) no banco. */
export function fmtLessons(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
}

/** 1.234 */
export function num(v: number): string {
  return (v || 0).toLocaleString("pt-BR")
}

// ─── Deltas ───────────────────────────────────────────────────────────────────

export interface Delta {
  /** Variação percentual, ou null quando não há base de comparação. */
  value:   number | null
  /** "+12%" · "-4%" · "novo" */
  label:   string
  /** Como pintar o badge. `higherIsBetter=false` inverte (custo, inadimplência). */
  variant: "success" | "danger" | "muted"
}

/**
 * Variação de `current` sobre `previous`.
 *
 * Com `previous === 0` não existe percentual honesto (divisão por zero), então
 * devolve "novo" em vez de um +100% enganoso.
 */
export function delta(
  current: number,
  previous: number,
  higherIsBetter = true,
): Delta {
  if (!previous) {
    return { value: null, label: current ? "novo" : "—", variant: "muted" }
  }
  const v    = ((current - previous) / Math.abs(previous)) * 100
  const good = higherIsBetter ? v >= 0 : v <= 0
  return {
    value:   v,
    label:   `${v >= 0 ? "+" : ""}${v.toFixed(v > -10 && v < 10 ? 1 : 0).replace(".", ",")}%`,
    variant: Math.abs(v) < 0.5 ? "muted" : good ? "success" : "danger",
  }
}

/** Variação em pontos percentuais — para margens, que já são %. */
export function deltaPP(current: number, previous: number, higherIsBetter = true): Delta {
  const v = current - previous
  if (!Number.isFinite(v)) return { value: null, label: "—", variant: "muted" }
  const good = higherIsBetter ? v >= 0 : v <= 0
  return {
    value:   v,
    label:   `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}pp`,
    variant: Math.abs(v) < 0.1 ? "muted" : good ? "success" : "danger",
  }
}

/** Margem % protegida contra divisão por zero. */
export function margin(profit: number, revenue: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0
}
