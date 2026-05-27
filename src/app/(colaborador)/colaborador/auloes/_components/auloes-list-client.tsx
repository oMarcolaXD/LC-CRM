"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Users, MapPin, Wifi, Plus, Library, Tag, CheckCircle2,
  Clock, ChevronRight, Repeat2,
} from "lucide-react"
import { Button }                    from "@/components/ui/button"
import { Badge }                     from "@/components/ui/badge"
import { CreateAulaoDialog }         from "@/components/shared/create-aulao-dialog"
import { CreateGroupLessonDialog }   from "@/components/shared/create-group-lesson-dialog"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AulaoItem {
  id:                string
  lessonType:        "AULAO" | "GROUP"
  title:             string | null
  teacherName:       string
  teacherId:         string
  subjectName:       string
  scheduledAt:       string   // ISO string
  duration:          number
  modality:          "PRESENCIAL" | "ONLINE"
  status:            string
  enrolled:          number
  capacity:          number | null
  isFree:            boolean
  recurrenceGroupId: string | null
}

export interface TeacherOption {
  id:           string
  name:         string
  teachingMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjects:     { id: string; name: string }[]
}

export interface StudentOption {
  id:   string
  name: string
}

type Filter = "proximos" | "historico" | "todos"

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado",
  MISSED:    "Não realizado",
}

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800 border-amber-300",
  CONFIRMED: "bg-blue-100  text-blue-800  border-blue-300",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-300",
  CANCELLED: "bg-rose-100  text-rose-700  border-rose-300",
  MISSED:    "bg-orange-100 text-orange-700 border-orange-300",
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AuloesListClient({
  auloes,
  teachers,
  students,
}: {
  auloes:   AulaoItem[]
  teachers: TeacherOption[]
  students: StudentOption[]
}) {
  const [filter, setFilter]           = useState<Filter>("proximos")
  const [showAulaoDialog, setShowAulaoDialog]   = useState(false)
  const [showGroupDialog, setShowGroupDialog]   = useState(false)

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  const filtered = auloes.filter(a => {
    if (filter === "proximos")  return ["SCHEDULED", "CONFIRMED"].includes(a.status)
    if (filter === "historico") return ["COMPLETED", "CANCELLED", "MISSED"].includes(a.status)
    return true
  })

  const proximosCount  = auloes.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status)).length
  const historicoCount = auloes.filter(a => ["COMPLETED", "CANCELLED", "MISSED"].includes(a.status)).length

  return (
    <>
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 rounded-lg border border-input bg-muted/30 p-1">
          {(["proximos", "historico", "todos"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "proximos"  ? `Próximos (${proximosCount})`  :
               f === "historico" ? `Histórico (${historicoCount})` : "Todos"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-blue-400/50 text-blue-700 hover:bg-blue-50"
            onClick={() => setShowGroupDialog(true)}
          >
            <Users className="w-4 h-4" />
            Novo grupo
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => setShowAulaoDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Nova aulão
          </Button>
        </div>
      </div>

      {/* Lista de aulões */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <Library className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {filter === "proximos"  ? "Nenhum aulão ou grupo agendado"  :
             filter === "historico" ? "Nenhum histórico encontrado"      : "Nenhum aulão cadastrado"}
          </p>
          <Button size="sm" variant="outline" className="mt-1" onClick={() => setShowAulaoDialog(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar aulão
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => {
            const dt       = new Date(a.scheduledAt)
            const endDt    = new Date(dt.getTime() + a.duration * 60_000)
            const isAulao  = a.lessonType === "AULAO"
            const ModeIcon = a.modality === "ONLINE" ? Wifi : MapPin
            const countLabel = a.capacity ? `${a.enrolled}/${a.capacity}` : String(a.enrolled)
            const isFull   = !!a.capacity && a.enrolled >= a.capacity

            return (
              <Link
                key={a.id}
                href={`/colaborador/auloes/${a.id}`}
                className={`group block rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-md ${
                  isAulao
                    ? "bg-violet-50 border-violet-200 hover:border-violet-400"
                    : "bg-blue-50 border-blue-200 hover:border-blue-400"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      isAulao ? "bg-violet-200 text-violet-800" : "bg-blue-200 text-blue-800"
                    }`}>
                      {isAulao ? "Aulão" : "Grupo"}
                    </span>
                    {a.recurrenceGroupId && (
                      <Repeat2 className={`w-3 h-3 shrink-0 ${isAulao ? "text-violet-500" : "text-blue-500"}`} aria-label="Recorrente" />
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${STATUS_CLASS[a.status] ?? ""}`}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </div>

                {/* Título */}
                <div>
                  <p className={`text-sm font-semibold leading-tight ${isAulao ? "text-violet-900" : "text-blue-900"}`}>
                    {a.title ?? a.subjectName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">com {a.teacherName.split(" ")[0]} · {a.subjectName}</p>
                </div>

                {/* Data e hora */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {format(dt, "EEE, dd 'de' MMM", { locale: ptBR })} · {format(dt, "HH:mm")}–{format(endDt, "HH:mm")}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-current/10">
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`flex items-center gap-1 font-medium ${isFull ? "text-rose-600" : "text-muted-foreground"}`}>
                      <Users className="w-3.5 h-3.5" />
                      {countLabel} aluno{a.enrolled !== 1 ? "s" : ""}
                    </span>
                    <span className={`flex items-center gap-1 ${a.isFree ? "text-emerald-600" : "text-amber-700"}`}>
                      {a.isFree
                        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Gratuito</>
                        : <><Tag className="w-3.5 h-3.5" /> Pago</>
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground/60">
                    <ModeIcon className="w-3.5 h-3.5" />
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreateAulaoDialog
        open={showAulaoDialog}
        onClose={() => setShowAulaoDialog(false)}
        students={students}
        teachers={teachers}
        defaultDate={todayStr}
      />
      <CreateGroupLessonDialog
        open={showGroupDialog}
        onClose={() => setShowGroupDialog(false)}
        students={students}
        teachers={teachers}
        defaultDate={todayStr}
      />
    </>
  )
}
