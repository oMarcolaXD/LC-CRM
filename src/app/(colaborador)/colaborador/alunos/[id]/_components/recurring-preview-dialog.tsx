"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  AlertTriangle, CalendarClock, Check, Loader2, RefreshCw, Trash2, Wallet, History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"
import {
  isCreatable,
  type RecurringPreview, type RecurringSlotPreview, type SlotRef, type SlotVerdict,
} from "@/lib/recurrence"
import {
  previewRecurringLessonsAction, createRecurringLessonsAction,
} from "@/lib/actions/lesson-request"

export interface RecurringParams {
  teacherId: string
  studentId: string
  subjectId: string
  modality:  "PRESENCIAL" | "ONLINE"
  duration:  number
  slots:     SlotRef[]
}

interface Props {
  params:      RecurringParams | null
  studentName: string
  onClose:     () => void
  onCreated:   (result: { created: number; conflicts: { date: string; reason: string }[] }) => void
}

const VERDICT_STYLE: Record<SlotVerdict, { label: string; row: string; chip: string }> = {
  OK: {
    label: "Livre",
    row:   "border-border bg-background",
    chip:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  PAST: {
    label: "Já passou",
    row:   "border-border bg-muted/40",
    chip:  "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  TEACHER_CONFLICT: {
    label: "Conflito",
    row:   "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
    chip:  "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  ROOM_CONFLICT: {
    label: "Sem sala",
    row:   "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
    chip:  "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  NO_BALANCE: {
    label: "Sem saldo",
    row:   "border-destructive/40 bg-destructive/5",
    chip:  "bg-destructive/10 text-destructive",
  },
}

function fmtAulas(n: number): string {
  const label = n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
  return `${label} aula${n === 1 ? "" : "s"}`
}

export function RecurringPreviewDialog({ params, studentName, onClose, onCreated }: Props) {
  const [slots, setSlots]     = useState<SlotRef[]>([])
  const [preview, setPreview] = useState<RecurringPreview | null>(null)
  // Editar uma exceção invalida a verificação anterior — nada é criado sem
  // reverificar, senão o usuário confirmaria em cima de dados velhos.
  const [stale, setStale]     = useState(false)
  const [checking, startCheck] = useTransition()
  const [saving,   startSave]  = useTransition()

  const open = params !== null

  const runPreview = useCallback((list: SlotRef[]) => {
    if (!params) return
    startCheck(async () => {
      try {
        const result = ouFalhe(await previewRecurringLessonsAction({
          teacherId: params.teacherId,
          studentId: params.studentId,
          slots:     list,
          modality:  params.modality,
          duration:  params.duration,
        }))
        setPreview(result)
        setSlots(result.slots.map(({ date, time }) => ({ date, time })))
        setStale(false)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao verificar a série"))
        onClose()
      }
    })
    // `params` é estável enquanto o modal está aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Primeira verificação ao abrir
  useEffect(() => {
    if (!params) { setPreview(null); setSlots([]); setStale(false); return }
    setSlots(params.slots)
    runPreview(params.slots)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function editSlot(index: number, patch: Partial<SlotRef>) {
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
    setStale(true)
  }

  function removeSlot(index: number) {
    setSlots(prev => prev.filter((_, i) => i !== index))
    setStale(true)
  }

  /** Descarta de uma vez todas as ocorrências que não podem ser criadas. */
  function dropBlocked() {
    if (!preview) return
    const keep = preview.slots
      .filter(s => isCreatable(s.verdict))
      .map(({ date, time }) => ({ date, time }))
    setSlots(keep)
    setStale(true)
  }

  function confirm() {
    if (!params) return
    startSave(async () => {
      try {
        const result = ouFalhe(await createRecurringLessonsAction({
          teacherId: params.teacherId,
          studentId: params.studentId,
          subjectId: params.subjectId,
          slots,
          modality:  params.modality,
          duration:  params.duration,
        }))
        onCreated(result)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao criar a série"))
      }
    })
  }

  const rows: (RecurringSlotPreview | SlotRef)[] = stale ? slots : (preview?.slots ?? [])
  const busy = checking || saving

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Revisar série — {studentName}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        {preview && !stale && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                {preview.creatableCount} serão criadas
              </span>
              {preview.blockedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {preview.blockedCount} indisponí{preview.blockedCount === 1 ? "vel" : "veis"}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                <Wallet className="w-3.5 h-3.5" />
                saldo {fmtAulas(preview.balanceRemaining)} → {fmtAulas(preview.balanceAfter)}
              </span>
            </div>

            {preview.blockedCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Ajuste a data ou o horário das ocorrências marcadas abaixo, ou remova-as.
                As demais serão criadas normalmente.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum conflito na série. Confira as datas e confirme.
              </p>
            )}
          </div>
        )}

        {stale && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              Você alterou a série ({slots.length} ocorrência{slots.length !== 1 ? "s" : ""}).
              Reverifique para ver a disponibilidade dos novos horários.
            </span>
          </div>
        )}

        {/* Lista de ocorrências */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {checking && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando a agenda…
            </div>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((row, i) => {
                const evaluated = "verdict" in row ? row : null
                const style     = evaluated ? VERDICT_STYLE[evaluated.verdict] : null
                const editable  = !evaluated || !isCreatable(evaluated.verdict)

                return (
                  <li
                    key={`${row.date}-${row.time}-${i}`}
                    className={`rounded-lg border px-3 py-2 text-xs ${style?.row ?? "border-border bg-background"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>

                      {editable ? (
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          <Input
                            type="date"
                            value={row.date}
                            onChange={(e) => editSlot(i, { date: e.target.value })}
                            className="h-7 w-[9.5rem] text-xs"
                          />
                          <Input
                            type="time"
                            value={row.time}
                            onChange={(e) => editSlot(i, { time: e.target.value })}
                            className="h-7 w-[5.5rem] text-xs"
                          />
                        </div>
                      ) : (
                        <span className="flex-1 font-medium text-foreground">{evaluated!.label}</span>
                      )}

                      {style && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${style.chip}`}>
                          {style.label}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        disabled={busy}
                        title="Remover da série"
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {evaluated?.reason && (
                      <p className="mt-1 flex items-start gap-1.5 pl-8 text-muted-foreground">
                        {evaluated.verdict === "PAST"
                          ? <History className="w-3 h-3 shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
                        {evaluated.reason}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            {preview && !stale && preview.blockedCount > 0 && (
              <Button variant="outline" size="sm" onClick={dropBlocked} disabled={busy}>
                Remover indisponíveis
              </Button>
            )}
          </div>

          {stale ? (
            <Button size="sm" onClick={() => runPreview(slots)} disabled={busy || slots.length === 0}>
              {checking && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reverificar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={confirm}
              disabled={busy || !preview || preview.creatableCount === 0}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Confirmar {preview?.creatableCount ?? 0} aula{preview?.creatableCount !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
