"use client"

// Cascata: para onde foi o dinheiro que entrou.
//
// Cada barra parte de onde a anterior terminou, então dá para ler de olho quanto
// cada dedução come do faturamento até sobrar o lucro. Implementado como barra
// empilhada com a primeira faixa transparente — é o truque padrão de waterfall
// em Recharts, que não tem esse tipo nativo.

import { useState, useEffect } from "react"
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { useChartTheme } from "@/hooks/use-dark-mode"
import { brlCompact, brl } from "@/lib/reports/format"

export interface WaterfallStep {
  label: string
  value: number
  /** Totais (receita bruta, lucro) desenham do zero; deduções descem do acumulado. */
  kind:  "total" | "deduction"
}

interface Row {
  label: string
  base:  number
  span:  number
  value: number
  kind:  WaterfallStep["kind"]
  color: string
}

const COLOR = {
  start:     "var(--primary)",
  deduction: "#f87171",
  profit:    "#10b981",
  loss:      "#ef4444",
}

export function WaterfallChart({
  steps, height = 260,
}: {
  steps: WaterfallStep[]
  height?: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const t = useChartTheme()

  const rows: Row[] = []
  let running = 0

  steps.forEach((s, i) => {
    if (s.kind === "total") {
      // Primeiro total = ponto de partida; último = resultado acumulado.
      const isFirst = i === 0
      const value   = isFirst ? s.value : running
      rows.push({
        label: s.label,
        base:  Math.min(0, value),
        span:  Math.abs(value),
        value,
        kind:  "total",
        color: isFirst ? COLOR.start : value >= 0 ? COLOR.profit : COLOR.loss,
      })
      if (isFirst) running = s.value
    } else {
      const next = running - s.value
      rows.push({
        label: s.label,
        base:  Math.min(running, next),
        span:  Math.abs(s.value),
        value: -s.value,
        kind:  "deduction",
        color: COLOR.deduction,
      })
      running = next
    }
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 12, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 3" stroke={t.gridColor} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10.5, fill: t.tickColor }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: t.tickColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={brlCompact}
        />
        <ReferenceLine y={0} stroke={t.tickColor} strokeWidth={1} />

        <Tooltip
          contentStyle={{
            background: t.bg, border: t.border, borderRadius: 10,
            fontSize: 12, color: t.labelColor, boxShadow: t.shadow,
          }}
          labelStyle={{ color: t.labelColor, fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: t.itemColor }}
          cursor={{ fill: t.cursor }}
          animationDuration={150}
          formatter={(_v: unknown, _n: unknown, item: unknown) => {
            const row = (item as { payload?: Row })?.payload
            if (!row) return ["", ""]
            return [brl(row.value), row.kind === "total" ? "Total" : "Dedução"]
          }}
        />

        {/* Faixa invisível que empurra a barra até a altura certa da cascata. */}
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar
          dataKey="span"
          stackId="w"
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          isAnimationActive={mounted}
          animationDuration={900}
        >
          {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
