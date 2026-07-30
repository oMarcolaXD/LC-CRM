"use client"

import { useState, useTransition } from "react"
import { Button }     from "@/components/ui/button"
import { Checkbox }   from "@/components/ui/checkbox"
import { RequestCard } from "@/components/shared/request-card"
import { bulkApproveRequestsAction, bulkRejectRequestsAction } from "@/lib/actions/lesson-request"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { mensagemDeErro } from "@/lib/error-message"

export interface RequestData {
  id:              string
  studentId:       string
  studentName:     string
  teacherName:     string
  subjectName:     string
  preferredAt:     Date
  notes:           string | null
  teacherMode:     "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  requestModality: "PRESENCIAL" | "ONLINE"
  isGroupRequest:  boolean
  groupNote:       string | null
  seriesIndex:     number | null
  seriesTotal:     number | null
  remainingLessons: number | null
  packageExpired:  boolean
  hasConflict:     boolean
  outOfSchedule:   boolean
}

export interface RequestGroup {
  label:    string
  dateKey:  string
  requests: RequestData[]
}

interface RequestsClientProps {
  groups: RequestGroup[]
}

export function RequestsClient({ groups }: RequestsClientProps) {
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkPending, startBulkTrans] = useTransition()

  const allIds = groups.flatMap((g) => g.requests.map((r) => r.id))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === allIds.length ? new Set() : new Set(allIds))
  }

  function handleBulkApprove() {
    const ids = Array.from(selected)
    startBulkTrans(async () => {
      try {
        const result = await bulkApproveRequestsAction(ids)
        if (result.approved > 0) toast.success(`${result.approved} aula(s) aprovada(s)`)
        if (result.failed.length > 0)
          toast.error(`${result.failed.length} falharam — verifique pacote/conflitos`)
        setSelected(new Set())
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro"))
      }
    })
  }

  function handleBulkReject() {
    const ids = Array.from(selected)
    startBulkTrans(async () => {
      try {
        await bulkRejectRequestsAction(ids)
        toast.success(`${ids.length} solicitação(ões) recusada(s)`)
        setSelected(new Set())
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro"))
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de seleção / ações em lote */}
      <div className="flex items-center justify-between gap-3 min-h-[32px]">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allIds.length > 0 && selected.size === allIds.length}
            onCheckedChange={toggleAll}
            aria-label="Selecionar todas"
            disabled={bulkPending}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selecionada(s)` : "Selecionar todas"}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" disabled={bulkPending}
              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleBulkReject}
            >
              {bulkPending
                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                : <XCircle className="w-3 h-3 mr-1" />
              }
              Recusar selecionadas
            </Button>
            <Button
              size="sm" disabled={bulkPending}
              className="h-7 text-xs"
              onClick={handleBulkApprove}
            >
              {bulkPending
                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                : <CheckCircle2 className="w-3 h-3 mr-1" />
              }
              Aprovar selecionadas
            </Button>
          </div>
        )}
      </div>

      {/* Grupos por data */}
      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {group.label}
          </p>
          {group.requests.map((r) => (
            <RequestCard
              key={r.id}
              id={r.id}
              studentId={r.studentId}
              studentName={r.studentName}
              teacherName={r.teacherName}
              subjectName={r.subjectName}
              preferredAt={r.preferredAt}
              notes={r.notes}
              teacherMode={r.teacherMode}
              requestModality={r.requestModality}
              isGroupRequest={r.isGroupRequest}
              groupNote={r.groupNote}
              seriesIndex={r.seriesIndex}
              seriesTotal={r.seriesTotal}
              remainingLessons={r.remainingLessons}
              packageExpired={r.packageExpired}
              hasConflict={r.hasConflict}
              outOfSchedule={r.outOfSchedule}
              selectable
              selected={selected.has(r.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
