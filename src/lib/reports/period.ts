// Período dos relatórios.
//
// Fonte única do "de quando até quando" para /admin/relatorios e /admin/dashboard.
// A escolha vive na URL (?periodo=…&de=…&ate=…), nunca em estado de cliente, para
// que o link seja compartilhável e a impressão saia com o mesmo recorte da tela.
//
// Todo cálculo parte de `nowBrazil()` — a Vercel roda em UTC e, sem isso, no fim
// da noite o "este mês" viraria o mês seguinte.

import {
  format, startOfMonth, endOfMonth, subMonths, addMonths,
  startOfYear, endOfYear, subYears, differenceInCalendarMonths,
  startOfDay, endOfDay, isValid, parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export const PERIODOS = [
  { id: "mes",           label: "Este mês"      },
  { id: "mes-anterior",  label: "Mês anterior"  },
  { id: "3meses",        label: "3 meses"       },
  { id: "6meses",        label: "6 meses"       },
  { id: "12meses",       label: "12 meses"      },
  { id: "ano",           label: "Este ano"      },
  { id: "ano-anterior",  label: "Ano anterior"  },
  { id: "personalizado", label: "Personalizado" },
] as const

export type Periodo = typeof PERIODOS[number]["id"]

export const VALID_PERIODOS = PERIODOS.map((p) => p.id) as readonly Periodo[]

/** Um ponto do eixo X: um mês fechado, com rótulo pronto. */
export interface ChartPoint {
  start: Date
  end:   Date
  label: string
  /** chave "YYYY-M" para casar com resultados de DATE_TRUNC */
  key:   string
}

export interface PeriodBounds {
  periodo:     Periodo
  start:       Date
  end:         Date
  /** Janela equivalente imediatamente anterior, para o delta % */
  prevStart:   Date
  prevEnd:     Date
  periodLabel: string
  /** Meses do gráfico. Sempre ≥ 1; para "este mês" mostra os 6 últimos como contexto. */
  chartPoints: ChartPoint[]
  /** true quando o recorte é exatamente um mês (metas mensais valem direto) */
  isMonthly:   boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

/**
 * Chave de mês para um valor vindo de `DATE_TRUNC('month', …)`.
 *
 * As colunas de data são `timestamp` sem fuso; o Postgres devolve
 * "2026-08-01 00:00:00" e o Prisma decodifica isso como meia-noite **UTC**.
 * Ler com `getMonth()` numa máquina em UTC-3 daria 31/07 — ou seja, agosto
 * inteiro cairia na coluna de julho. Por isso a leitura tem de ser em UTC.
 *
 * Use esta função para qualquer data que veio de agregação SQL; para datas
 * construídas em JS (os pontos do gráfico), use `monthKey`.
 */
export function monthKeyFromDb(d: Date | string): string {
  const v = d instanceof Date ? d : new Date(d)
  return `${v.getUTCFullYear()}-${v.getUTCMonth() + 1}`
}

/** Mesma correção, devolvendo um Date ancorado no fuso local (para formatar). */
export function dateFromDbMonth(d: Date | string): Date {
  const v = d instanceof Date ? d : new Date(d)
  return new Date(v.getUTCFullYear(), v.getUTCMonth(), 1)
}

function point(d: Date, pattern = "MMM"): ChartPoint {
  const start = startOfMonth(d)
  return {
    start,
    end:   endOfMonth(d),
    label: format(d, pattern, { locale: ptBR }),
    key:   monthKey(start),
  }
}

/** Meses fechados entre duas datas (inclusive), como pontos de gráfico. */
export function monthsIn(start: Date, end: Date): ChartPoint[] {
  const n = differenceInCalendarMonths(end, start) + 1
  const pattern = n > 12 ? "MMM/yy" : "MMM"
  return Array.from({ length: Math.max(1, n) }, (_, i) => point(addMonths(start, i), pattern))
}

function lastMonths(ref: Date, n: number): ChartPoint[] {
  const pattern = n > 12 ? "MMM/yy" : "MMM"
  return Array.from({ length: n }, (_, i) => point(subMonths(ref, n - 1 - i), pattern))
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Bounds ───────────────────────────────────────────────────────────────────

/**
 * Traduz o período escolhido em datas concretas.
 *
 * `custom` só é lido quando `periodo === "personalizado"`; se vier inválido,
 * cai em "este mês" para nunca renderizar uma tela quebrada.
 */
export function getPeriodBounds(
  periodo: Periodo,
  now: Date,
  custom?: { de?: string | null; ate?: string | null },
): PeriodBounds {
  switch (periodo) {
    case "mes-anterior": {
      const ref = subMonths(now, 1)
      return {
        periodo,
        start:       startOfMonth(ref),
        end:         endOfMonth(ref),
        prevStart:   startOfMonth(subMonths(now, 2)),
        prevEnd:     endOfMonth(subMonths(now, 2)),
        periodLabel: cap(format(ref, "MMMM 'de' yyyy", { locale: ptBR })),
        chartPoints: lastMonths(ref, 6),
        isMonthly:   true,
      }
    }

    case "3meses": {
      const start = startOfMonth(subMonths(now, 2))
      return {
        periodo,
        start,
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 5)),
        prevEnd:     endOfMonth(subMonths(now, 3)),
        periodLabel: `${cap(format(start, "MMM", { locale: ptBR }))} – ${cap(format(now, "MMM 'de' yyyy", { locale: ptBR }))}`,
        chartPoints: lastMonths(now, 3),
        isMonthly:   false,
      }
    }

    case "6meses": {
      const start = startOfMonth(subMonths(now, 5))
      return {
        periodo,
        start,
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 11)),
        prevEnd:     endOfMonth(subMonths(now, 6)),
        periodLabel: `${cap(format(start, "MMM", { locale: ptBR }))} – ${cap(format(now, "MMM 'de' yyyy", { locale: ptBR }))}`,
        chartPoints: lastMonths(now, 6),
        isMonthly:   false,
      }
    }

    case "12meses": {
      const start = startOfMonth(subMonths(now, 11))
      return {
        periodo,
        start,
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 23)),
        prevEnd:     endOfMonth(subMonths(now, 12)),
        periodLabel: `${cap(format(start, "MMM/yy", { locale: ptBR }))} – ${cap(format(now, "MMM/yy", { locale: ptBR }))}`,
        chartPoints: lastMonths(now, 12),
        isMonthly:   false,
      }
    }

    case "ano": {
      const start = startOfYear(now)
      return {
        periodo,
        start,
        end:         endOfMonth(now),
        prevStart:   startOfYear(subYears(now, 1)),
        prevEnd:     endOfYear(subYears(now, 1)),
        periodLabel: format(now, "yyyy"),
        chartPoints: monthsIn(start, endOfMonth(now)),
        isMonthly:   false,
      }
    }

    case "ano-anterior": {
      const ref   = subYears(now, 1)
      const start = startOfYear(ref)
      const end   = endOfYear(ref)
      return {
        periodo,
        start,
        end,
        prevStart:   startOfYear(subYears(now, 2)),
        prevEnd:     endOfYear(subYears(now, 2)),
        periodLabel: format(ref, "yyyy"),
        chartPoints: monthsIn(start, end),
        isMonthly:   false,
      }
    }

    case "personalizado": {
      const de  = parseDateParam(custom?.de)
      const ate = parseDateParam(custom?.ate)
      if (!de || !ate || de > ate) return getPeriodBounds("mes", now)

      const start = startOfDay(de)
      const end   = endOfDay(ate)
      // Janela anterior de mesma duração, colada no início do recorte.
      const span      = end.getTime() - start.getTime()
      const prevEnd   = new Date(start.getTime() - 1)
      const prevStart = new Date(prevEnd.getTime() - span)

      return {
        periodo,
        start,
        end,
        prevStart,
        prevEnd,
        periodLabel: `${format(start, "dd/MM/yyyy")} – ${format(end, "dd/MM/yyyy")}`,
        chartPoints: monthsIn(startOfMonth(start), endOfMonth(end)),
        isMonthly:   monthKey(start) === monthKey(end),
      }
    }

    default: { // "mes"
      return {
        periodo:     "mes",
        start:       startOfMonth(now),
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 1)),
        prevEnd:     endOfMonth(subMonths(now, 1)),
        periodLabel: cap(format(now, "MMMM 'de' yyyy", { locale: ptBR })),
        chartPoints: lastMonths(now, 6),
        isMonthly:   true,
      }
    }
  }
}

// ─── searchParams ─────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → Date, ou null se ausente/inválida. */
function parseDateParam(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = parseISO(v)
  return isValid(d) ? d : null
}

export interface ReportSearchParams {
  periodo?: string
  de?:      string
  ate?:     string
}

/** Normaliza os searchParams da URL num período válido. */
export function parsePeriodo(sp: ReportSearchParams): Periodo {
  const raw = sp.periodo
  return (VALID_PERIODOS as readonly string[]).includes(raw ?? "")
    ? (raw as Periodo)
    : "mes"
}

/**
 * Query string a preservar ao navegar entre abas — sem ela, trocar de aba
 * jogaria o usuário de volta para "este mês".
 */
export function periodQuery(sp: ReportSearchParams): string {
  const params = new URLSearchParams()
  const periodo = parsePeriodo(sp)
  if (periodo !== "mes") params.set("periodo", periodo)
  if (periodo === "personalizado") {
    if (sp.de)  params.set("de",  sp.de)
    if (sp.ate) params.set("ate", sp.ate)
  }
  return params.size ? `?${params}` : ""
}
