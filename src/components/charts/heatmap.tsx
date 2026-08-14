"use client"

// Heatmap em grid CSS puro — sem Recharts.
//
// Serve para duas leituras diferentes do relatório: coorte (mês de entrada ×
// meses de vida) e ocupação (dia da semana × hora). Em ambas o que importa é
// enxergar o padrão de longe, não ler o valor exato — o número exato fica no
// title de cada célula.

import { useMemo } from "react"
import { useDarkMode } from "@/hooks/use-dark-mode"

export interface HeatCell {
  value: number | null
  title: string
  label?: string
}

export interface HeatRow {
  label:    string
  sublabel?: string
  cells:    HeatCell[]
}

export function Heatmap({
  columns, rows, peak, accent = "251, 133, 0",
}: {
  columns: string[]
  rows:    HeatRow[]
  /** Valor que corresponde à intensidade máxima. */
  peak:    number
  /** Cor base em "r, g, b" — o alpha é que varia com a intensidade. */
  accent?: string
}) {
  const dark = useDarkMode()

  const intensity = useMemo(
    () => (v: number) => (peak > 0 ? Math.min(1, v / peak) : 0),
    [peak],
  )

  return (
    <div className="-mx-[14px] overflow-x-auto px-[14px]">
      <table className="border-separate text-[11px]" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card pr-2 text-left text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground" />
            {columns.map((c) => (
              <th
                key={c}
                className="min-w-[38px] px-1 pb-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="sticky left-0 z-10 whitespace-nowrap bg-card pr-2 text-right align-middle text-[11px] font-medium">
                {r.label}
                {r.sublabel && (
                  <span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">
                    {r.sublabel}
                  </span>
                )}
              </th>
              {r.cells.map((cell, i) => {
                if (cell.value == null) {
                  return (
                    <td
                      key={i}
                      className="h-[26px] min-w-[38px] rounded-[4px]"
                      style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}
                    />
                  )
                }
                const a = intensity(cell.value)
                return (
                  <td
                    key={i}
                    title={cell.title}
                    className="h-[26px] min-w-[38px] rounded-[4px] text-center align-middle font-mono text-[10px] tabular-nums"
                    style={{
                      background: `rgba(${accent}, ${(0.08 + a * 0.82).toFixed(3)})`,
                      color: a > 0.55 ? "#fff" : dark ? "#e5e7eb" : "#1f2937",
                    }}
                  >
                    {cell.label}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
