"use client"

import { useState } from "react"
import {
  addWeeks, subWeeks, addDays, startOfWeek,
  format, isSameDay, isToday, getHours, getMinutes,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const START_HOUR = 7
const END_HOUR   = 22
const HOUR_H     = 64 // px per hour

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-[#FB8500] border-orange-600 text-white",
  CONFIRMED: "bg-brand-blue border-[#1a7a96] text-white",
  COMPLETED: "bg-green-600/70 border-green-700 text-white",
  CANCELLED: "bg-red-400/70  border-red-500  text-white",
  MISSED:    "bg-red-400/70  border-red-500  text-white",
}

export type CalendarLesson = {
  id:          string
  scheduledAt: string   // ISO
  duration:    number   // minutes
  status:      string
  modality:    string
  student:     { user: { name: string } }
  subject:     { name: string }
}

function lessonPosition(lesson: CalendarLesson) {
  const d            = new Date(lesson.scheduledAt)
  const startMinutes = (getHours(d) - START_HOUR) * 60 + getMinutes(d)
  const top          = (startMinutes / 60) * HOUR_H
  const height       = Math.max((lesson.duration / 60) * HOUR_H, 28)
  return { top: `${top}px`, height: `${height}px` }
}

export function TeacherWeekCalendar({ lessons }: { lessons: CalendarLesson[] }) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const dayLessons = (day: Date) =>
    lessons.filter((l) => isSameDay(new Date(l.scheduledAt), day))

  return (
    <div className="rounded-xl border border-border overflow-hidden select-none">
      {/* ── Header navigation ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <span className="font-sub font-semibold text-sm">
          {format(weekStart, "dd 'de' MMMM", { locale: ptBR })}
          {" – "}
          {format(addDays(weekStart, 6), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm" className="h-7 text-xs px-2"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Day headers ── */}
      <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn("py-2 text-center border-l border-border", isToday(day) && "bg-primary/10")}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {format(day, "EEE", { locale: ptBR })}
            </p>
            <p className={cn("text-sm font-bold leading-tight", isToday(day) ? "text-primary" : "")}>
              {format(day, "dd")}
            </p>
          </div>
        ))}
      </div>

      {/* ── Time grid ── */}
      <div className="overflow-y-auto" style={{ maxHeight: "540px" }}>
        <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: `${HOURS.length * HOUR_H}px` }}>
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted-foreground leading-none"
                style={{ top: `${(h - START_HOUR) * HOUR_H - 6}px` }}
              >
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn("relative border-l border-border", isToday(day) && "bg-primary/5")}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/40"
                  style={{ top: `${(h - START_HOUR) * HOUR_H}px` }}
                />
              ))}

              {/* Half-hour dashed lines */}
              {HOURS.map((h) => (
                <div
                  key={`${h}-half`}
                  className="absolute inset-x-0 border-t border-dashed border-border/20"
                  style={{ top: `${(h - START_HOUR) * HOUR_H + HOUR_H / 2}px` }}
                />
              ))}

              {/* Lesson blocks */}
              {dayLessons(day).map((lesson) => {
                const pos = lessonPosition(lesson)
                return (
                  <a
                    key={lesson.id}
                    href={`/professor/agenda/${lesson.id}`}
                    className={cn(
                      "absolute inset-x-1 rounded-md border px-1.5 py-0.5 overflow-hidden",
                      "hover:opacity-90 hover:shadow-md transition-all cursor-pointer",
                      STATUS_STYLE[lesson.status] ?? "bg-gray-400 text-white border-gray-500",
                    )}
                    style={pos}
                    title={`${lesson.subject.name} — ${lesson.student.user?.name ?? "Aluno"}\n${format(new Date(lesson.scheduledAt), "HH:mm")}`}
                  >
                    <p className="text-[11px] font-semibold leading-tight truncate">
                      {format(new Date(lesson.scheduledAt), "HH:mm")} {lesson.subject.name}
                    </p>
                    <p className="text-[10px] leading-tight truncate opacity-90">
                      {lesson.student.user?.name ?? "Aluno"}
                    </p>
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
        {[
          { label: "Agendada",  color: "bg-[#FB8500]" },
          { label: "Confirmada",color: "bg-brand-blue" },
          { label: "Realizada", color: "bg-green-600/70" },
          { label: "Cancelada", color: "bg-red-400/70" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("inline-block w-2.5 h-2.5 rounded-sm", color)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
