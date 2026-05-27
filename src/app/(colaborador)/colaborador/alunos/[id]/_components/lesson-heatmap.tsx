"use client"

import { useMemo, useState } from "react"
import { format, subDays, startOfDay, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"

export interface HeatmapEntry {
  date: string   // ISO string
  status: string // LessonStatus
}

interface Props {
  entries: HeatmapEntry[]
}

const WEEKS = 13
const DAYS  = WEEKS * 7  // 91 days

function getColor(count: number, hasMissed: boolean): string {
  if (hasMissed && count === 0) return "bg-red-200 dark:bg-red-900/40"
  if (hasMissed) return "bg-red-400 dark:bg-red-600"
  if (count === 0) return "bg-muted/40"
  if (count === 1) return "bg-primary/30"
  if (count === 2) return "bg-primary/60"
  return "bg-primary"
}

export function LessonHeatmap({ entries }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const cells = useMemo(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: DAYS }, (_, i) => {
      const date   = subDays(today, DAYS - 1 - i)
      const dayEntries = entries.filter(e => isSameDay(new Date(e.date), date))
      const done   = dayEntries.filter(e => e.status === "COMPLETED").length
      const missed = dayEntries.filter(e => e.status === "MISSED").length
      return { date, done, missed }
    })
  }, [entries])

  // Month labels: one per month, dropping labels that are < 3 weeks from the next
  // (prevents overlap when a month occupies only a few days at the start of the window)
  const monthLabels = useMemo(() => {
    const raw: { weekIndex: number; label: string }[] = []
    let lastMonth = -1
    cells.forEach((c, i) => {
      const weekIndex = Math.floor(i / 7)
      const month = c.date.getMonth()
      if (month !== lastMonth) {
        raw.push({ weekIndex, label: format(c.date, "MMM", { locale: ptBR }) })
        lastMonth = month
      }
    })
    // Drop a label when the next one starts within 3 weeks (text would overlap)
    return raw.filter((m, i) => {
      const next = raw[i + 1]
      return !next || next.weekIndex - m.weekIndex >= 3
    })
  }, [cells])

  // Columns = weeks (left to right), rows = days (Mon→Sun top to bottom)
  const weeks: typeof cells[] = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7))
  }

  return (
    <div className="relative select-none">
      {/* Month labels — positioned absolutely to avoid overlap */}
      <div className="relative mb-1" style={{ height: 14 }}>
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground leading-none"
            style={{ left: m.weekIndex * 16 }}
          >
            {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex" style={{ gap: 3 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: 3 }}>
            {week.map((cell, di) => {
              const color = getColor(cell.done, cell.missed > 0)
              const hasSomething = cell.done > 0 || cell.missed > 0
              return (
                <div
                  key={di}
                  className={`cursor-default transition-opacity hover:opacity-80 ${color}`}
                  style={{ width: 13, height: 13, minWidth: 13, minHeight: 13, borderRadius: 2 }}
                  onMouseEnter={(e) => {
                    if (!hasSomething) {
                      setTooltip({ text: format(cell.date, "dd/MM/yyyy", { locale: ptBR }), x: e.clientX, y: e.clientY })
                      return
                    }
                    const parts: string[] = [format(cell.date, "dd/MM/yyyy", { locale: ptBR })]
                    if (cell.done > 0)   parts.push(`${cell.done} realizada${cell.done > 1 ? "s" : ""}`)
                    if (cell.missed > 0) parts.push(`${cell.missed} falta${cell.missed > 1 ? "s" : ""}`)
                    setTooltip({ text: parts.join(" · "), x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
        <span>menos</span>
        <div className="flex gap-1">
          {["bg-muted/40","bg-primary/30","bg-primary/60","bg-primary"].map((c, i) => (
            <div key={i} className={`w-3 h-3 ${c}`} style={{ borderRadius: 2 }} />
          ))}
        </div>
        <span>mais</span>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-3 h-3 bg-red-400" style={{ borderRadius: 2 }} />
          <span>faltou</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md border border-border"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
