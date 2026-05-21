"use client"

import { useState, useTransition }  from "react"
import { toast }                    from "sonner"
import { approveRequestAction, rejectRequestAction } from "@/lib/actions/lesson-request"
import { format }                   from "date-fns"
import { ptBR }                     from "date-fns/locale"
import Link                         from "next/link"
import { Loader2 }                  from "lucide-react"

interface PedidoRowProps {
  id:          string
  studentName: string
  respName:    string
  teacherName: string
  teacherMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjectName: string
  preferredAt: string
  modality:    "PRESENCIAL" | "ONLINE"
  notes?:      string | null
  horasAtras:  number
  tag:         "novo" | "antigo" | "pendente"
}

export function PedidoRow({
  id, studentName, respName, teacherName, teacherMode,
  subjectName, preferredAt, modality, notes, horasAtras, tag,
}: PedidoRowProps) {
  const [pending, startTransition] = useTransition()
  const [mod] = useState<"PRESENCIAL" | "ONLINE">(
    teacherMode === "ONLINE_ONLY" ? "ONLINE" : modality
  )

  const dateStr = format(new Date(preferredAt), "dd/MM (EEE) · HH:mm", { locale: ptBR })

  const haLabel =
    horasAtras < 1  ? "< 1h"                           :
    horasAtras < 24 ? `${horasAtras}h`                 :
                      `${Math.floor(horasAtras / 24)}d`

  const barColor  =
    tag === "novo"   ? "var(--primary)" :
    tag === "antigo" ? "var(--danger)"  : "var(--border)"

  const tagStyle =
    tag === "novo"   ? { background: "var(--accent-soft)", color: "var(--primary)" } :
    tag === "antigo" ? { background: "var(--danger-soft)", color: "var(--danger)"  } :
                       { background: "var(--hover)",       color: "var(--subtle)"   }

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveRequestAction(id, mod)
        toast.success("Aula confirmada")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao confirmar")
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectRequestAction(id)
        toast.success("Pedido recusado")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao recusar")
      }
    })
  }

  return (
    <div
      className="grid items-center gap-3 px-3 py-[10px]"
      style={{ gridTemplateColumns: "4px 1fr auto" }}
    >
      {/* Colored left bar */}
      <div
        className="self-stretch rounded-[2px]"
        style={{ background: barColor, minWidth: 4, width: 4 }}
      />

      {/* Info */}
      <div className="min-w-0">
        <div className="mb-[3px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-semibold">{studentName}</span>
          {respName !== studentName && (
            <span className="text-[10.5px] text-muted-foreground">de {respName}</span>
          )}
          <span
            className="rounded-[3px] px-[6px] py-px font-mono text-[10px]"
            style={tagStyle}
          >
            há {haLabel}
          </span>
        </div>
        <div className="text-[11.5px] leading-[1.3] text-muted-foreground">
          <span style={{ color: "var(--text-2)" }}>{subjectName}</span>
          {" "}com{" "}
          <span style={{ color: "var(--text-2)" }}>{teacherName}</span>
          {" · "}
          <span className="font-mono" style={{ color: "var(--text-2)" }}>{dateStr}</span>
          {notes && (
            <span className="ml-2" style={{ color: "var(--subtle)" }}>
              &ldquo;{notes.slice(0, 40)}{notes.length > 40 ? "…" : ""}&rdquo;
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <Link
          href="/colaborador/agendamentos"
          className="rounded-[5px] border border-border bg-card px-[9px] py-[5px] text-center text-[11px] font-medium transition-colors hover:bg-[var(--hover)]"
          style={{ color: "var(--text-2)" }}
        >
          Sugerir outro
        </Link>
        <button
          disabled={pending}
          onClick={handleReject}
          className="rounded-[5px] border px-[9px] py-[5px] text-[11px] font-medium transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-50"
          style={{ borderColor: "var(--danger-soft)", background: "var(--card)", color: "var(--danger)" }}
        >
          {pending ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Recusar"}
        </button>
        <button
          disabled={pending}
          onClick={handleApprove}
          className="rounded-[5px] px-[10px] py-[5px] text-[11px] font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {pending ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Confirmar"}
        </button>
      </div>
    </div>
  )
}
