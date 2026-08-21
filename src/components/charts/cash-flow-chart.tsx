"use client"

// Entradas (para cima) × saídas (para baixo) com o acumulado em linha.
//
// Desenhar a saída como valor negativo é o que deixa a leitura imediata: o mês em
// que a barra vermelha passa da azul é um mês em que saiu mais do que entrou,
// independente do que o DRE diga sobre lucro.

import { useState, useEffect } from "react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { useChartTheme } from "@/hooks/use-dark-mode"
import { brlCompact, brl } from "@/lib/reports/format"

export interface CashPoint {
  label:    string
  entradas: number
  saidas:   number   // valor negativo
  acumulado: number
}

const KEY_LABEL: Record<string, string> = {
  entradas:  "Entradas",
  saidas:    "Saídas",
  acumulado: "Acumulado",
}

export function CashFlowChart({ data, height = 280 }: { data: CashPoint[]; height?: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const t = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 4, left: -12, bottom: 0 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="2 3" stroke={t.gridColor} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.tickColor }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: t.tickColor }}
          axisLine={false} tickLine={false}
          tickFormatter={brlCompact}
        />
        <ReferenceLine y={0} stroke={t.tickColor} strokeWidth={1} />

        <Tooltip
          contentStyle={{
            background: t.bg, border: t.border, borderRadius: 10,
            fontSize: 12, color: t.labelColor, boxShadow: t.shadow,
          }}
          labelStyle={{ color: t.labelColor, fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: t.itemColor }}
          formatter={(v: unknown, name: unknown) => [
            brl(Math.abs(Number(v))),
            KEY_LABEL[String(name)] ?? String(name),
          ]}
          cursor={{ fill: t.cursor }}
          animationDuration={150}
        />
        <Legend
          verticalAlign="top" height={28} iconType="circle" iconSize={7}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: t.tickColor }}>{KEY_LABEL[value] ?? value}</span>
          )}
        />

        <Bar dataKey="entradas" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={34}
          isAnimationActive={mounted} animationDuration={900} />
        <Bar dataKey="saidas" fill="#f87171" radius={[0, 0, 4, 4]} maxBarSize={34}
          isAnimationActive={mounted} animationDuration={900} />
        <Line type="monotone" dataKey="acumulado" stroke="#10b981" strokeWidth={2}
          dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: t.cardBg }}
          isAnimationActive={mounted} animationDuration={900} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
