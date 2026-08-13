"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Users, MapPin, Wifi, Plus, Library, Tag, CheckCircle2,
  Clock, ChevronRight, Repeat2, Search, X,
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

/** Busca sem acento e sem caixa — "matematica" acha "Matemática". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** "2026-08" → rótulo do seletor de mês. */
function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number)
  return format(new Date(ano, mes - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado",
  MISSED:    "Não realizado",
}

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
  CONFIRMED: "bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-900/40  dark:text-blue-400  dark:border-blue-800",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  CANCELLED: "bg-rose-100  text-rose-700  border-rose-300  dark:bg-rose-900/40  dark:text-rose-400  dark:border-rose-800",
  MISSED:    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800",
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
  const [busca, setBusca]             = useState("")
  const [professor, setProfessor]     = useState("")
  const [tipo, setTipo]               = useState<"" | "AULAO" | "GROUP">("")
  const [mes, setMes]                 = useState("")
  const [showAulaoDialog, setShowAulaoDialog]   = useState(false)
  const [showGroupDialog, setShowGroupDialog]   = useState(false)

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  // Opções dos seletores saem da própria lista: só aparece professor/mês que
  // de fato tem aulão — evita varrer um combo cheio de opção vazia.
  const professores = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const a of auloes) mapa.set(a.teacherId, a.teacherName)
    return [...mapa].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name))
  }, [auloes])

  const meses = useMemo(() => {
    const chaves = new Set(auloes.map(a => a.scheduledAt.slice(0, 7)))
    return [...chaves].sort().reverse()
  }, [auloes])

  const filtered = useMemo(() => {
    const termo = normalizar(busca.trim())

    const lista = auloes.filter(a => {
      if (filter === "proximos"  && !["SCHEDULED", "CONFIRMED"].includes(a.status))            return false
      if (filter === "historico" && !["COMPLETED", "CANCELLED", "MISSED"].includes(a.status))  return false
      if (professor && a.teacherId !== professor)                                              return false
      if (tipo      && a.lessonType !== tipo)                                                  return false
      if (mes       && a.scheduledAt.slice(0, 7) !== mes)                                      return false
      if (!termo) return true
      return normalizar(`${a.title ?? ""} ${a.teacherName} ${a.subjectName}`).includes(termo)
    })

    // Em "Próximos", o mais perto vem primeiro — é o que a secretaria procura.
    // No histórico, o mais recente.
    return lista.sort((x, y) =>
      filter === "proximos"
        ? x.scheduledAt.localeCompare(y.scheduledAt)
        : y.scheduledAt.localeCompare(x.scheduledAt)
    )
  }, [auloes, filter, busca, professor, tipo, mes])

  const proximosCount  = auloes.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status)).length
  const historicoCount = auloes.filter(a => ["COMPLETED", "CANCELLED", "MISSED"].includes(a.status)).length
  const filtrosAtivos  = !!(busca.trim() || professor || tipo || mes)

  function limparFiltros() {
    setBusca(""); setProfessor(""); setTipo(""); setMes("")
  }

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
            className="gap-1.5 border-blue-400/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
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

      {/* Busca e filtros — com 50 aulões na lista, achar um pelo nome é o caminho */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por título, professor ou matéria..."
              className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <select
            value={professor}
            onChange={e => setProfessor(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os professores</option>
            {professores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as "" | "AULAO" | "GROUP")}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Aulões e grupos</option>
            <option value="AULAO">Só aulões</option>
            <option value="GROUP">Só grupos</option>
          </select>

          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Qualquer mês</option>
            {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
          </select>

          {filtrosAtivos && (
            <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={limparFiltros}>
              <X className="w-3.5 h-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {filtrosAtivos && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            {filter === "proximos" ? " entre os próximos" : filter === "historico" ? " no histórico" : ""}
          </p>
        )}
      </div>

      {/* Lista de aulões */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <Library className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {filtrosAtivos          ? "Nenhum aulão bate com esses filtros" :
             filter === "proximos"  ? "Nenhum aulão ou grupo agendado"      :
             filter === "historico" ? "Nenhum histórico encontrado"         : "Nenhum aulão cadastrado"}
          </p>
          {filtrosAtivos ? (
            <Button size="sm" variant="outline" className="mt-1" onClick={limparFiltros}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Limpar filtros
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="mt-1" onClick={() => setShowAulaoDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar aulão
            </Button>
          )}
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
                    ? "bg-violet-50 border-violet-200 hover:border-violet-400 dark:bg-violet-950/30 dark:border-violet-900 dark:hover:border-violet-700"
                    : "bg-blue-50 border-blue-200 hover:border-blue-400 dark:bg-blue-950/30 dark:border-blue-900 dark:hover:border-blue-700"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      isAulao
                        ? "bg-violet-200 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300"
                        : "bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
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
                  <p className={`text-sm font-semibold leading-tight ${isAulao ? "text-violet-900 dark:text-violet-200" : "text-blue-900 dark:text-blue-200"}`}>
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
                    <span className={`flex items-center gap-1 font-medium ${isFull ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      <Users className="w-3.5 h-3.5" />
                      {countLabel} aluno{a.enrolled !== 1 ? "s" : ""}
                    </span>
                    <span className={`flex items-center gap-1 ${a.isFree ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
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
