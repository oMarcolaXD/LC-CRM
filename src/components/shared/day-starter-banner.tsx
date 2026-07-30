"use client"

import { useState } from "react"
import { CheckCircle } from "lucide-react"
import { ConfirmacoesModal } from "./confirmacoes-modal"
import type { ConfirmacaoItem } from "./confirmacoes-modal"
import type { NotificationStatus } from "@/lib/notifications/status"

export type { ConfirmacaoItem }

interface DayStarterBannerProps {
  scheduledCount:   number
  confirmacaoItems: ConfirmacaoItem[]
  dateLabel:        string
  notificationStatus: NotificationStatus
}

export function DayStarterBanner({
  scheduledCount,
  confirmacaoItems,
  dateLabel,
  notificationStatus,
}: DayStarterBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)

  if (scheduledCount === 0) return null

  return (
    <>
      <div
        className="grid items-center gap-4 rounded-[10px] border border-border px-[18px] py-[14px]"
        style={{
          gridTemplateColumns: "1fr auto",
          background: "var(--accent-soft)",
        }}
      >
        <div className="flex items-center gap-[14px]">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-lg font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            !
          </div>
          <div className="leading-[1.35]">
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--text)" }}>
              {scheduledCount}{" "}
              {scheduledCount === 1 ? "aula precisa" : "aulas precisam"} de confirmação para hoje
            </p>
            <p className="mt-0.5 font-mono text-[11.5px]" style={{ color: "var(--accent-ink)" }}>
              <span className="font-semibold">{confirmacaoItems.filter(i => i.tipo === "responsavel").length}</span>{" "}
              responsáveis ·{" "}
              <span className="font-semibold">{confirmacaoItems.filter(i => i.tipo === "professor").length}</span>{" "}
              professores
              {confirmacaoItems.filter(i => i.tipo === "pacote").length > 0 && (
                <span style={{ color: "var(--danger)" }}>
                  {" "}·{" "}
                  <span className="font-semibold">{confirmacaoItems.filter(i => i.tipo === "pacote").length}</span>{" "}
                  {confirmacaoItems.filter(i => i.tipo === "pacote").length === 1 ? "pacote vencido" : "pacotes vencidos"}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-[7px] border border-border bg-card px-[14px] py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--hover)]"
            style={{ color: "var(--text)" }}
            onClick={() => setModalOpen(true)}
          >
            Ver pendências
          </button>
          <button
            className="flex items-center gap-1.5 rounded-[7px] px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)" }}
            onClick={() => setModalOpen(true)}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Iniciar confirmações do dia
          </button>
        </div>
      </div>

      <ConfirmacoesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={confirmacaoItems}
        dateLabel={dateLabel}
        notificationStatus={notificationStatus}
      />
    </>
  )
}
