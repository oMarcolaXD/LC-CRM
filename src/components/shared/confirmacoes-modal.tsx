"use client"

import { useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Send } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { sendConfirmationsBatchAction } from "@/lib/actions/colaborador"

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface ConfirmacaoItem {
  key:            string
  lessonId:       string
  tipo:           "responsavel" | "professor" | "pacote"
  recipientName:  string
  recipientRole:  string
  recipientPhone: string | null
  recipientEmail: string | null
  aula:           string
  via:            "WhatsApp" | "E-mail"
  preview:        string
  daysLate?:      number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Canal  = "WhatsApp" | "E-mail" | "SMS"
type Quando = "Agora"   | "Em 30 min" | "Programar"
type Tom    = "Cordial" | "Direto"    | "Custom"

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// ─── Segmented control ────────────────────────────────────────────────────────

function Seg<T extends string>({
  opts, value, onChange,
}: {
  opts:     T[]
  value:    T
  onChange: (v: T) => void
}) {
  return (
    <div
      className="flex rounded-[6px] border border-border p-0.5"
      style={{ background: "var(--card)" }}
    >
      {opts.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className="flex-1 rounded-[4px] py-1 text-[11.5px] text-center transition-colors"
          style={{
            fontWeight:  o === value ? 500 : 400,
            color:       o === value ? "var(--text)"  : "var(--muted-foreground)" ,
            background:  o === value ? "var(--bg)"    : "transparent",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ─── Seção colapsável ──────────────────────────────────────────────────────────

type SectionColor = "accent" | "info" | "danger"

function Section({
  title, sub, color, items, expanded, onToggle,
  selected, onToggleItem, onSelectAll,
  previews, onPreviewChange,
}: {
  title:           string
  sub:             string
  color:           SectionColor
  items:           ConfirmacaoItem[]
  expanded:        boolean
  onToggle:        () => void
  selected:        Set<string>
  onToggleItem:    (key: string) => void
  onSelectAll:     () => void
  previews:        Record<string, string>
  onPreviewChange: (key: string, val: string) => void
}) {
  const selectedCount = items.filter(i => selected.has(i.key)).length

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-[22px] py-[14px]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2.5 text-left"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
          <div className="leading-[1.3]">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">{title}</span>
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                style={{
                  background: `var(--${color}-soft)`,
                  color:      `var(--${color})`,
                }}
              >
                {selectedCount}/{items.length}
              </span>
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>
          </div>
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Selecionar todos
          </button>
          <button
            type="button"
            className="text-[11px] font-medium"
            style={{ color: "var(--primary)" }}
            onClick={() => toast.info("Templates em breve")}
          >
            Editar template →
          </button>
        </div>
      </div>

      {/* Rows */}
      {expanded && (
        <div className="px-[10px] pb-3 space-y-0.5">
          {items.map(item => (
            <ConfirmacaoRow
              key={item.key}
              item={item}
              color={color}
              checked={selected.has(item.key)}
              onToggle={() => onToggleItem(item.key)}
              preview={previews[item.key] ?? item.preview}
              onPreviewChange={val => onPreviewChange(item.key, val)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Linha de confirmação ──────────────────────────────────────────────────────

function ConfirmacaoRow({
  item, color, checked, onToggle, preview, onPreviewChange,
}: {
  item:            ConfirmacaoItem
  color:           SectionColor
  checked:         boolean
  onToggle:        () => void
  preview:         string
  onPreviewChange: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div
      className="grid items-start gap-2.5 rounded-[8px] px-3 py-[10px]"
      style={{
        gridTemplateColumns: "20px 32px 1fr 80px 28px",
        opacity: checked ? 1 : 0.5,
      }}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-[4px]"
        style={{
          border:     `1.5px solid ${checked ? `var(--${color})` : "var(--border-strong)"}`,
          background: checked ? `var(--${color})` : "transparent",
          color:      "#fff",
          fontSize:   10,
          fontWeight: 700,
        }}
      >
        {checked ? "✓" : ""}
      </button>

      {/* Avatar */}
      <div
        className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{
          background: "var(--card-2)",
          border:     "1px solid var(--border)",
          color:      "var(--text-2)",
        }}
      >
        {initials(item.recipientName)}
      </div>

      {/* Content */}
      <div className="min-w-0 leading-[1.35]">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[13px] font-semibold">{item.recipientName}</span>
          <span className="text-[11px] text-muted-foreground">{item.recipientRole}</span>
          {item.daysLate != null && (
            <span
              className="rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {item.daysLate}d atraso
            </span>
          )}
        </div>
        <div className="mb-[5px] text-[11px]" style={{ color: "var(--text-2)" }}>
          {item.aula}
        </div>

        {/* Preview editável */}
        {preview && (
          editing ? (
            <textarea
              autoFocus
              value={preview}
              onChange={e => onPreviewChange(e.target.value)}
              onBlur={() => setEditing(false)}
              rows={2}
              className="w-full resize-none rounded-[6px] border border-input bg-background px-2.5 py-1.5 text-[11.5px] leading-[1.4] focus:outline-none focus:ring-1 focus:ring-primary/40"
              style={{ color: "var(--text-2)" }}
            />
          ) : (
            <div
              onClick={() => setEditing(true)}
              className="cursor-text rounded-[6px] border border-border px-[9px] py-[7px] text-[11.5px] leading-[1.4]"
              style={{
                background: "var(--card-2)",
                color:      "var(--text-2)",
              }}
            >
              <span
                className="mb-0.5 block font-mono text-[10px]"
                style={{ color: "var(--subtle)" }}
              >
                preview · clique para editar
              </span>
              {preview}
            </div>
          )
        )}
      </div>

      {/* Canal */}
      <div className="mt-1 flex justify-end">
        <span
          className="rounded-[4px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
          style={{
            background: "var(--success-soft)",
            color:      "var(--success)",
          }}
        >
          {item.via}
        </span>
      </div>

      {/* Opções */}
      <button
        type="button"
        className="mt-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[14px] text-muted-foreground hover:bg-[var(--hover)]"
        onClick={() => toast.info("Em breve")}
      >
        ⋯
      </button>
    </div>
  )
}

// ─── Modal principal ───────────────────────────────────────────────────────────

interface ConfirmacoesModalProps {
  open:        boolean
  onClose:     () => void
  items:       ConfirmacaoItem[]
  dateLabel:   string
}

export function ConfirmacoesModal({
  open, onClose, items, dateLabel,
}: ConfirmacoesModalProps) {
  const responsaveis = items.filter(i => i.tipo === "responsavel")
  const professores  = items.filter(i => i.tipo === "professor")
  const pacotes      = items.filter(i => i.tipo === "pacote")

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map(i => i.key))
  )
  const [canal,    setCanal]    = useState<Canal>("WhatsApp")
  const [quando,   setQuando]   = useState<Quando>("Agora")
  const [tom,      setTom]      = useState<Tom>("Cordial")
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["responsavel", "professor", "pacote"])
  )
  const [previews, setPreviews] = useState<Record<string, string>>(
    () => Object.fromEntries(items.map(i => [i.key, i.preview]))
  )
  const [pending, start] = useTransition()

  const toggleItem    = (key: string) =>
    setSelected(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const toggleSection = (tipo: string) =>
    setExpanded(prev => { const n = new Set(prev); if (n.has(tipo)) n.delete(tipo); else n.add(tipo); return n })
  const selectAll     = (grupo: ConfirmacaoItem[]) =>
    setSelected(prev => { const n = new Set(prev); grupo.forEach(i => n.add(i.key)); return n })
  const setPreview    = (key: string, val: string) =>
    setPreviews(prev => ({ ...prev, [key]: val }))

  const selectedItems = items.filter(i => selected.has(i.key))
  const waCount       = selectedItems.filter(i => i.via === "WhatsApp").length
  const emCount       = selectedItems.filter(i => i.via === "E-mail").length

  const handleSend = () =>
    start(async () => {
      try {
        await sendConfirmationsBatchAction(
          selectedItems.map(i => ({
            key:          i.key,
            lessonId:     i.lessonId,
            destinatario: i.tipo === "professor" ? "professor" : "responsavel",
            mensagem:     previews[i.key] ?? i.preview,
          }))
        )
        toast.success(`${selectedItems.length} mensagens enviadas!`)
        onClose()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar")
      }
    })

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-80px)] flex-col gap-0 p-0"
      >
        {/* ── Header ── */}
        <DialogHeader className="shrink-0 border-b border-border px-[22px] py-[18px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Confirmações do dia
              </p>
              <DialogTitle className="mt-1 text-[19px] font-semibold tracking-[-0.015em]">
                {dateLabel} · {selectedItems.length} mensagens prontas
              </DialogTitle>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {items.filter(i => i.tipo !== "professor").length} aulas pendentes ·{" "}
                <span className="font-medium" style={{ color: "var(--text-2)" }}>
                  {responsaveis.length} responsáveis
                </span>{" "}·{" "}
                <span className="font-medium" style={{ color: "var(--text-2)" }}>
                  {professores.length} professores
                </span>
                {pacotes.length > 0 && (
                  <>
                    {" "}·{" "}
                    <span className="font-medium" style={{ color: "var(--danger)" }}>
                      {pacotes.length} pacote{pacotes.length > 1 ? "s" : ""} vencido{pacotes.length > 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-border text-[18px] text-muted-foreground hover:bg-[var(--hover)]"
            >
              ×
            </button>
          </div>
        </DialogHeader>

        {/* ── Controles ── */}
        <div
          className="grid shrink-0 gap-2.5 border-b border-border px-[22px] py-[14px]"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr",
            background: "var(--card-2)",
          }}
        >
          <div>
            <p className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Canal padrão</p>
            <Seg opts={["WhatsApp", "E-mail", "SMS"] as Canal[]} value={canal} onChange={setCanal} />
          </div>
          <div>
            <p className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Quando enviar</p>
            <Seg opts={["Agora", "Em 30 min", "Programar"] as Quando[]} value={quando} onChange={setQuando} />
          </div>
          <div>
            <p className="mb-[5px] text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Tom da mensagem</p>
            <Seg opts={["Cordial", "Direto", "Custom"] as Tom[]} value={tom} onChange={setTom} />
          </div>
        </div>

        {/* ── Seções ── */}
        <div className="flex-1 overflow-y-auto">
          {responsaveis.length > 0 && (
            <Section
              title="Confirmar com responsáveis"
              sub="Pergunta se a aula está mantida. Lembrete amistoso."
              color="accent"
              items={responsaveis}
              expanded={expanded.has("responsavel")}
              onToggle={() => toggleSection("responsavel")}
              selected={selected}
              onToggleItem={toggleItem}
              onSelectAll={() => selectAll(responsaveis)}
              previews={previews}
              onPreviewChange={setPreview}
            />
          )}
          {professores.length > 0 && (
            <Section
              title="Pedir confirmação aos professores"
              sub="Confirma se o professor virá e está com o material."
              color="info"
              items={professores}
              expanded={expanded.has("professor")}
              onToggle={() => toggleSection("professor")}
              selected={selected}
              onToggleItem={toggleItem}
              onSelectAll={() => selectAll(professores)}
              previews={previews}
              onPreviewChange={setPreview}
            />
          )}
          {pacotes.length > 0 && (
            <Section
              title="Alertar pacote vencido antes da aula"
              sub="Mensagem extra para responsáveis com pagamento pendente."
              color="danger"
              items={pacotes}
              expanded={expanded.has("pacote")}
              onToggle={() => toggleSection("pacote")}
              selected={selected}
              onToggleItem={toggleItem}
              onSelectAll={() => selectAll(pacotes)}
              previews={previews}
              onPreviewChange={setPreview}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-[22px] py-[14px]">
          <div className="leading-[1.3]">
            <p className="text-[13.5px] font-semibold">
              {selectedItems.length} mensagens selecionadas{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (de {items.length} disponíveis)
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {waCount > 0 && <><span style={{ color: "var(--text-2)" }}>{waCount}</span> WhatsApp</>}
              {waCount > 0 && emCount > 0 && " · "}
              {emCount > 0 && <><span style={{ color: "var(--text-2)" }}>{emCount}</span> E-mail</>}
              {" "}· respostas chegam direto na agenda
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.info("Agendamento em breve")}
              disabled={pending}
            >
              Programar para 08:30
            </Button>
            <Button
              onClick={handleSend}
              disabled={pending || selectedItems.length === 0}
              className="gap-1.5"
            >
              {pending
                ? "Enviando…"
                : <><Send className="h-3.5 w-3.5" /> Enviar agora</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
