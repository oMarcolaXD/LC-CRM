"use client"

import { useState, useTransition } from "react"
import {
  Users, MapPin, Wifi, Tag, CheckCircle2, Clock, XCircle, Loader2,
  UserPlus, UserMinus, BookOpen, Building2, Home, Repeat2, Pencil, Check, X,
  RotateCcw, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge }  from "@/components/ui/badge"
import { toast }  from "sonner"
import { useRouter } from "next/navigation"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"
import { EditAulaoDialog } from "@/components/shared/edit-aulao-dialog"
import type { EditTeacherOption } from "@/components/shared/edit-aulao-dialog"
import {
  enrollStudentInAulaoAction,
  unenrollStudentFromAulaoAction,
  cancelAulaoAction,
  cancelAulaoSeriesAction,
  completeAulaoAction,
  renameAulaoAction,
  reactivateAulaoAction,
  deleteAulaoAction,
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
  teacherId:        string
  teacherName:      string
  subjectId:        string | null
  subjectName:      string
  scheduledAt:      string
  /** Data e hora no relógio de Brasília — o formulário de edição parte daqui. */
  date:             string // yyyy-MM-dd
  time:             string // HH:mm
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
  SCHEDULED: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
  CONFIRMED: "bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-900/40  dark:text-blue-400  dark:border-blue-800",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  CANCELLED: "bg-rose-100  text-rose-700  border-rose-300  dark:bg-rose-900/40  dark:text-rose-400  dark:border-rose-800",
  MISSED:    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800",
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
  PENDING: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
  PAID:    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800",
  OVERDUE: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800",
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AulaoDetailClient({
  aulao,
  allStudents,
  teachers,
  canDelete,
}: {
  aulao:       AulaoDetail
  allStudents: StudentOption[]
  teachers:    EditTeacherOption[]
  canDelete:   boolean
}) {
  const router = useRouter()
  const [showEnrollPanel, setShowEnrollPanel] = useState(false)
  const [searchTerm,      setSearchTerm]      = useState("")
  const [pending, start]                      = useTransition()
  const [editingTitle,    setEditingTitle]    = useState(false)
  const [titleDraft,      setTitleDraft]      = useState(aulao.title ?? aulao.subjectName)
  const [renaming, startRename]               = useTransition()
  const [showEditDialog,  setShowEditDialog]  = useState(false)

  const isAulao    = aulao.lessonType === "AULAO"
  const ModeIcon   = aulao.modality === "ONLINE" ? Wifi : MapPin
  const isClosed   = ["COMPLETED", "CANCELLED"].includes(aulao.status)
  const isCancelled = aulao.status === "CANCELLED"
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
        toast.error(mensagemDeErro(e, "Erro ao inscrever aluno"))
      }
    })
  }

  function unenroll(studentId: string, studentName: string) {
    start(async () => {
      try {
        await unenrollStudentFromAulaoAction(aulao.id, studentId)
        toast.success(`${studentName.split(" ")[0]} removido(a)`)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao remover aluno"))
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
        toast.error(mensagemDeErro(e, "Erro ao cancelar"))
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
        toast.error(mensagemDeErro(e, "Erro ao cancelar série"))
      }
    })
  }

  function saveTitle() {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === (aulao.title ?? aulao.subjectName)) {
      setEditingTitle(false)
      setTitleDraft(aulao.title ?? aulao.subjectName)
      return
    }
    startRename(async () => {
      try {
        await renameAulaoAction(aulao.id, trimmed)
        toast.success("Nome atualizado")
        setEditingTitle(false)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao renomear"))
      }
    })
  }

  function reactivate() {
    start(async () => {
      try {
        ouFalhe(await reactivateAulaoAction(aulao.id))
        toast.success("Aulão reativado — voltou para a agenda")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao reativar"))
      }
    })
  }

  function remove() {
    const nome = aulao.title ?? aulao.subjectName
    if (!confirm(
      `Excluir "${nome}" de vez?\n\n` +
      `O aulão some da agenda e do histórico, junto com as cobranças ainda não pagas. ` +
      `Não dá para desfazer — para apenas tirar da agenda, use "Cancelar aulão".`
    )) return

    start(async () => {
      try {
        ouFalhe(await deleteAulaoAction(aulao.id))
        toast.success("Aulão excluído")
        router.push("/colaborador/auloes")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao excluir"))
      }
    })
  }

  function complete() {
    start(async () => {
      try {
        await completeAulaoAction(aulao.id)
        toast.success("Aulão marcado como realizado")
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro"))
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Coluna esquerda: info + alunos ──────────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">

        {/* Info card */}
        <div className={`rounded-xl border p-5 space-y-4 ${
          isAulao
            ? "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900"
            : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
        }`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                isAulao
                  ? "bg-violet-200 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300"
                  : "bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
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
              aulao.isFree ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
            }`}>
              {aulao.isFree
                ? <><CheckCircle2 className="w-4 h-4" /> Gratuito</>
                : <><Tag className="w-4 h-4" /> R${aulao.pricePerStudent?.toFixed(2).replace(".", ",")} / aluno</>
              }
            </span>
          </div>

          <div>
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveTitle()
                    if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(aulao.title ?? aulao.subjectName) }
                  }}
                  disabled={renaming}
                  autoFocus
                  className="text-lg font-semibold rounded-lg border border-input bg-background px-2 py-1 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  disabled={renaming}
                  onClick={saveTitle}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 shrink-0"
                  title="Salvar"
                >
                  {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  disabled={renaming}
                  onClick={() => { setEditingTitle(false); setTitleDraft(aulao.title ?? aulao.subjectName) }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50 shrink-0"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="group flex items-center gap-1.5">
                <h2 className={`text-lg font-semibold ${isAulao ? "text-violet-900 dark:text-violet-200" : "text-blue-900 dark:text-blue-200"}`}>
                  {aulao.title ?? aulao.subjectName}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-opacity shrink-0"
                  title="Editar nome"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
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
                {isFull && <span className="ml-1 text-rose-600 dark:text-rose-400 font-medium">(lotado)</span>}
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
                        className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40"
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
              variant="outline"
              className="w-full gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
              disabled={pending}
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="w-4 h-4" />
              Editar aulão
            </Button>
          )}

          {isCancelled && (
            <Button
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              disabled={pending}
              onClick={reactivate}
            >
              {pending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />
              }
              Reativar aulão
            </Button>
          )}

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
              className="w-full gap-2 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
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
              className="w-full gap-2 border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs"
              disabled={pending}
              onClick={cancelSeries}
            >
              <Repeat2 className="w-3.5 h-3.5" />
              Cancelar série toda
            </Button>
          )}

          {isCancelled && (
            <p className="text-xs text-muted-foreground pt-1">
              Aulão cancelado — não aparece mais na grade da agenda e o horário está livre.
              Reative para colocá-lo de volta (as cobranças em aberto voltam junto).
            </p>
          )}

          {aulao.status === "COMPLETED" && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              Aulão realizado — o histórico não se edita.
            </p>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              className="w-full gap-2 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir definitivamente
            </Button>
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
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Pago</span>
                <span>{aulao.participants.filter(p => p.paymentStatus === "PAID").length} aluno(s)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <EditAulaoDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        teachers={teachers}
        aulao={{
          id:              aulao.id,
          lessonType:      aulao.lessonType,
          title:           aulao.title ?? aulao.subjectName,
          teacherId:       aulao.teacherId,
          subjectId:       aulao.subjectId ?? "",
          date:            aulao.date,
          time:            aulao.time,
          duration:        aulao.duration,
          modality:        aulao.modality,
          teacherOnsite:   aulao.teacherOnsite,
          capacity:        aulao.capacity,
          isFree:          aulao.isFree,
          pricePerStudent: aulao.pricePerStudent,
          enrolledCount:   aulao.participants.length,
        }}
      />
    </div>
  )
}
