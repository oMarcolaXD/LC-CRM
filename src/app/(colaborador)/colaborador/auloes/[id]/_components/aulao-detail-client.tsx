"use client"

import { useState, useTransition } from "react"
import {
  Users, MapPin, Wifi, Tag, CheckCircle2, Clock, XCircle, Loader2,
  UserPlus, UserMinus, BookOpen, Building2, Home, Repeat2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge }  from "@/components/ui/badge"
import { toast }  from "sonner"
import {
  enrollStudentInAulaoAction,
  unenrollStudentFromAulaoAction,
  cancelAulaoAction,
  cancelAulaoSeriesAction,
  completeAulaoAction,
} from "@/lib/actions/aulao"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ParticipantItem {
  studentId:   string
  studentName: string
  paymentStatus: "PENDING" | "PAID" | "OVERDUE" | null
}

export interface AulaoDetail {
  id:               string
  lessonType:       "AULAO" | "GROUP"
  title:            string | null
  teacherName:      string
  subjectName:      string
  scheduledAt:      string
  duration:         number
  modality:         "PRESENCIAL" | "ONLINE"
  teacherOnsite:    boolean
  status:           string
  capacity:         number | null
  isFree:           boolean
  pricePerStudent:  number | null
  participants:     ParticipantItem[]
  recurrenceGroupId: string | null
  recurrenceRule:   string | null
}

export interface StudentOption {
  id:   string
  name: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800 border-amber-300",
  CONFIRMED: "bg-blue-100  text-blue-800  border-blue-300",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-300",
  CANCELLED: "bg-rose-100  text-rose-700  border-rose-300",
  MISSED:    "bg-orange-100 text-orange-700 border-orange-300",
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado",
  MISSED:    "Não realizado",
}

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID:    "Pago",
  OVERDUE: "Em atraso",
}

const PAYMENT_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  PAID:    "bg-emerald-100 text-emerald-800 border-emerald-300",
  OVERDUE: "bg-rose-100 text-rose-700 border-rose-300",
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AulaoDetailClient({
  aulao,
  allStudents,
}: {
  aulao:       AulaoDetail
  allStudents: StudentOption[]
}) {
  const [showEnrollPanel, setShowEnrollPanel] = useState(false)
  const [searchTerm,      setSearchTerm]      = useState("")
  const [pending, start]                      = useTransition()

  const isAulao    = aulao.lessonType === "AULAO"
  const ModeIcon   = aulao.modality === "ONLINE" ? Wifi : MapPin
  const isClosed   = ["COMPLETED", "CANCELLED"].includes(aulao.status)
  const isFull     = !!aulao.capacity && aulao.participants.length >= aulao.capacity
  const enrolledIds = new Set(aulao.participants.map(p => p.studentId))

  const availableStudents = allStudents.filter(s =>
    !enrolledIds.has(s.id) &&
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function enroll(studentId: string) {
    start(async () => {
      try {
        await enrollStudentInAulaoAction(aulao.id, studentId)
        toast.success("Aluno inscrito com sucesso")
        setSearchTerm("")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao inscrever aluno")
      }
    })
  }

  function unenroll(studentId: string, studentName: string) {
    start(async () => {
      try {
        await unenrollStudentFromAulaoAction(aulao.id, studentId)
        toast.success(`${studentName.split(" ")[0]} removido(a)`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao remover aluno")
      }
    })
  }

  function cancel() {
    if (!confirm("Tem certeza que deseja cancelar este aulão?")) return
    start(async () => {
      try {
        await cancelAulaoAction(aulao.id)
        toast.success("Aulão cancelado")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao cancelar")
      }
    })
  }

  function cancelSeries() {
    if (!aulao.recurrenceGroupId) return
    if (!confirm("Deseja cancelar TODOS os aulões pendentes desta série recorrente?")) return
    start(async () => {
      try {
        await cancelAulaoSeriesAction(aulao.recurrenceGroupId!)
        toast.success("Série cancelada")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao cancelar série")
      }
    })
  }

  function complete() {
    start(async () => {
      try {
        await completeAulaoAction(aulao.id)
        toast.success("Aulão marcado como realizado")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro")
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Coluna esquerda: info + alunos ──────────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">

        {/* Info card */}
        <div className={`rounded-xl border p-5 space-y-4 ${
          isAulao ? "bg-violet-50 border-violet-200" : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                isAulao ? "bg-violet-200 text-violet-800" : "bg-blue-200 text-blue-800"
              }`}>
                {isAulao ? "Aulão" : "Grupo"}
              </span>
              <Badge variant="outline" className={`text-xs ${STATUS_CLASS[aulao.status] ?? ""}`}>
                {STATUS_LABEL[aulao.status] ?? aulao.status}
              </Badge>
              {aulao.recurrenceGroupId && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                  <Repeat2 className="w-3 h-3" />
                  {aulao.recurrenceRule === "WEEKLY" ? "Semanal" :
                   aulao.recurrenceRule === "BIWEEKLY" ? "Quinzenal" :
                   aulao.recurrenceRule === "MONTHLY" ? "Mensal" : "Recorrente"}
                </span>
              )}
            </div>
            <span className={`flex items-center gap-1.5 text-sm font-medium ${
              aulao.isFree ? "text-emerald-700" : "text-amber-700"
            }`}>
              {aulao.isFree
                ? <><CheckCircle2 className="w-4 h-4" /> Gratuito</>
                : <><Tag className="w-4 h-4" /> R${aulao.pricePerStudent?.toFixed(2).replace(".", ",")} / aluno</>
              }
            </span>
          </div>

          <div>
            <h2 className={`text-lg font-semibold ${isAulao ? "text-violet-900" : "text-blue-900"}`}>
              {aulao.title ?? aulao.subjectName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              <BookOpen className="inline w-3.5 h-3.5 mr-1" />
              {aulao.subjectName} · com {aulao.teacherName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {new Date(aulao.scheduledAt).toLocaleString("pt-BR", {
                  weekday: "short", day: "2-digit", month: "short",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{aulao.duration} min</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ModeIcon className="w-3.5 h-3.5 shrink-0" />
              <span>
                {aulao.modality === "PRESENCIAL" ? "Presencial" : "Online"}
                {aulao.modality === "ONLINE" && (
                  <span className="ml-1 text-xs">
                    ({aulao.teacherOnsite
                      ? <><Building2 className="inline w-3 h-3" /> na sede</>
                      : <><Home className="inline w-3 h-3" /> em casa</>
                    })
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {aulao.participants.length}
                {aulao.capacity ? `/${aulao.capacity}` : ""} aluno{aulao.participants.length !== 1 ? "s" : ""}
                {isFull && <span className="ml-1 text-rose-600 font-medium">(lotado)</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de alunos */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Alunos inscritos ({aulao.participants.length})
            </h3>
            {!isClosed && !isFull && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setShowEnrollPanel(v => !v)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Inscrever aluno
              </Button>
            )}
          </div>

          {/* Painel de busca/inscrição */}
          {showEnrollPanel && (
            <div className="px-5 py-3 border-b bg-muted/20 space-y-2">
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto divide-y rounded-lg border border-input bg-background">
                {availableStudents.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {searchTerm ? "Nenhum aluno encontrado" : "Todos os alunos já estão inscritos"}
                  </p>
                ) : (
                  availableStudents.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pending}
                      onClick={() => enroll(s.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      <span>{s.name}</span>
                      {pending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        : <UserPlus className="w-3.5 h-3.5 text-primary" />
                      }
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tabela de participantes */}
          {aulao.participants.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum aluno inscrito ainda.
            </div>
          ) : (
            <div className="divide-y">
              {aulao.participants.map((p, i) => (
                <div key={p.studentId} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                    <span className="text-sm font-medium">{p.studentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!aulao.isFree && p.paymentStatus && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${PAYMENT_CLASS[p.paymentStatus] ?? ""}`}
                      >
                        {PAYMENT_LABEL[p.paymentStatus] ?? p.paymentStatus}
                      </Badge>
                    )}
                    {!isClosed && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => unenroll(p.studentId, p.studentName)}
                        className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                        title="Remover aluno"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Coluna direita: ações ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ações</h3>

          {!isClosed && (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={pending || aulao.status === "COMPLETED"}
              onClick={complete}
            >
              {pending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />
              }
              Marcar como realizado
            </Button>
          )}

          {!["CANCELLED", "COMPLETED"].includes(aulao.status) && (
            <Button
              variant="outline"
              className="w-full gap-2 border-rose-300 text-rose-600 hover:bg-rose-50"
              disabled={pending}
              onClick={cancel}
            >
              {pending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <XCircle className="w-4 h-4" />
              }
              Cancelar aulão
            </Button>
          )}

          {aulao.recurrenceGroupId && !["CANCELLED", "COMPLETED"].includes(aulao.status) && (
            <Button
              variant="outline"
              className="w-full gap-2 border-rose-200 text-rose-500 hover:bg-rose-50 text-xs"
              disabled={pending}
              onClick={cancelSeries}
            >
              <Repeat2 className="w-3.5 h-3.5" />
              Cancelar série toda
            </Button>
          )}

          {isClosed && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              Aulão {aulao.status === "COMPLETED" ? "realizado" : "cancelado"} — sem ações disponíveis.
            </p>
          )}
        </div>

        {/* Resumo financeiro */}
        {!aulao.isFree && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h3>
            <div className="text-2xl font-bold text-foreground">
              R${((aulao.pricePerStudent ?? 0) * aulao.participants.length).toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground">
              {aulao.participants.length} aluno{aulao.participants.length !== 1 ? "s" : ""} ×{" "}
              R${(aulao.pricePerStudent ?? 0).toFixed(2).replace(".", ",")}
            </p>
            <div className="text-xs space-y-1 pt-1 border-t">
              <div className="flex justify-between text-muted-foreground">
                <span>Pendente</span>
                <span>{aulao.participants.filter(p => p.paymentStatus === "PENDING" || p.paymentStatus === "OVERDUE").length} aluno(s)</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Pago</span>
                <span>{aulao.participants.filter(p => p.paymentStatus === "PAID").length} aluno(s)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
