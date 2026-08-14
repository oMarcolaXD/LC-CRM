"use client"

// Receita × custo (barras) com a margem % sobreposta (linha, eixo direito).
//
// É o gráfico que responde a pergunta central da dona: o faturamento subiu, mas
// a margem acompanhou? Sem o segundo eixo dá para crescer faturando e encolher
// lucrando sem perceber.

import { useState, useEffect } from "react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { useChartTheme } from "@/hooks/use-dark-mode"
import { brlCompact, brl, pct } from "@/lib/reports/format"

export interface ComboPoint {
  label:   string
  receita: number
  custo:   number
  lucro:   number
  margem:  number   // %
}

const KEY_LABEL: Record<string, string> = {
  receita: "Receita líquida",
  custo:   "Custos",
  lucro:   "Lucro",
  margem:  "Margem",
}

export function ComboChart({ data, height = 280 }: { data: ComboPoint[]; height?: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const t = useChartTheme()

  const hasNegative = data.some((d) => d.lucro < 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 3" stroke={t.gridColor} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: t.tickColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="money"
          tick={{ fontSize: 10, fill: t.tickColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={brlCompact}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tick={{ fontSize: 10, fill: t.tickColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${Math.round(v)}%`}
          width={38}
        />

        {hasNegative && (
          <ReferenceLine yAxisId="money" y={0} stroke={t.tickColor} strokeWidth={1} />
        )}

        <Tooltip
          contentStyle={{
            background: t.bg, border: t.border, borderRadius: 10,
            fontSize: 12, color: t.labelColor, boxShadow: t.shadow,
          }}
          labelStyle={{ color: t.labelColor, fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: t.itemColor }}
          formatter={(v: unknown, name: unknown) => {
            const key = String(name)
            return [key === "margem" ? pct(Number(v)) : brl(Number(v)), KEY_LABEL[key] ?? key]
          }}
          cursor={{ fill: t.cursor }}
          animationDuration={150}
        />

        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          iconSize={7}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: t.tickColor }}>{KEY_LABEL[value] ?? value}</span>
          )}
        />

        <Bar yAxisId="money" dataKey="receita" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={34}
          isAnimationActive={mounted} animationDuration={900} />
        <Bar yAxisId="money" dataKey="custo" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={34}
          isAnimationActive={mounted} animationDuration={900} />
        <Line yAxisId="pct" type="monotone" dataKey="margem"
          stroke="#10b981" strokeWidth={2}
          dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: t.cardBg }}
          isAnimationActive={mounted} animationDuration={900} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
