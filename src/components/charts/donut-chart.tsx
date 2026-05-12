"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface DonutChartProps {
  data:    { label: string; value: number; color: string }[]
  height?: number
  inner?:  number
  outer?:  number
}

export function DonutChart({ data, height = 200, inner = 58, outer = 85 }: DonutChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="45%"
          innerRadius={inner}
          outerRadius={outer}
          dataKey="value"
          nameKey="label"
          paddingAngle={3}
          isAnimationActive={mounted}
          animationBegin={0}
          animationDuration={900}
          animationEasing="ease-out"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            fontSize: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
          formatter={(v) => {
            const n = Number(v ?? 0)
            return [`${n} (${total ? Math.round(n / total * 100) : 0}%)`, ""]
          }}
          animationDuration={150}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
          formatter={(value) => (
            <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
