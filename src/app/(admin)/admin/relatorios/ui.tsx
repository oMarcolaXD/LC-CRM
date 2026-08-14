import * as React from "react"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/shared/kpi-card"
import type { Delta } from "@/lib/reports/format"

// Peças visuais compartilhadas pelas abas de relatório.
//
// Seguem a linguagem do /admin/dashboard (números mono com tabular-nums, tokens
// var(--*), raio 10px, densidade alta) e não a dos Cards antigos: é o que torna
// a leitura de dez indicadores lado a lado possível sem rolar a página inteira.

// ─── Painel ───────────────────────────────────────────────────────────────────

export function Panel({
  title, subtitle, action, children, className,
}: {
  title:     string
  subtitle?: string
  action?:   React.ReactNode
  children:  React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-border bg-card print:break-inside-avoid",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-[14px] pb-2 pt-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="px-[14px] pb-3.5">{children}</div>
    </section>
  )
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

const DELTA_CLS: Record<Delta["variant"], string> = {
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger:  "bg-[var(--danger-soft)] text-[var(--danger)]",
  muted:   "bg-[var(--muted-soft)] text-muted-foreground",
}

export function StatGrid({
  cols = 4, children,
}: {
  cols?: 3 | 4 | 5
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-[10px] border border-border",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
        cols === 5 && "lg:grid-cols-5",
      )}
      style={{ gap: "1px", background: "var(--border)" }}
    >
      {children}
    </div>
  )
}

export function Stat({
  label, value, delta, sub, spark, sparkColor, tone,
}: {
  label:  string
  value:  string
  delta?: Delta
  sub?:   string
  spark?: number[]
  sparkColor?: string
  /** Pinta o número — use só onde o sinal importa (lucro, margem). */
  tone?: "positive" | "negative"
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-card p-[14px_16px_12px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded px-[5px] py-px font-mono text-[10px] font-semibold",
              DELTA_CLS[delta.variant],
            )}
          >
            {delta.label}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            "font-mono text-[22px] font-semibold leading-none tracking-[-0.025em]",
            tone === "positive" && "text-[var(--success)]",
            tone === "negative" && "text-[var(--danger)]",
          )}
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {value}
        </span>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? "var(--primary)"} width={84} height={24} />
        )}
      </div>

      {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-[14px] overflow-x-auto px-[14px]">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  )
}

export function Th({
  children, align = "left", className,
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border px-2.5 py-[7px] text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground",
        align === "right"  && "text-right",
        align === "center" && "text-center",
        align === "left"   && "text-left",
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children, align = "left", mono, className,
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
  mono?: boolean
  className?: string
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-[7px]",
        align === "right"  && "text-right",
        align === "center" && "text-center",
        mono && "font-mono",
        className,
      )}
      style={mono ? { fontFeatureSettings: '"tnum"' } : undefined}
    >
      {children}
    </td>
  )
}

// ─── Barra proporcional ───────────────────────────────────────────────────────

/** Barra de composição usada nas listas de ranking (top alunos, categorias…). */
export function Bar({ ratio, color = "var(--primary)" }: { ratio: number; color?: string }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color }}
      />
    </div>
  )
}

// ─── Vazio ────────────────────────────────────────────────────────────────────

export function Empty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      {hint && <p className="max-w-sm text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  )
}

// ─── Aviso / leitura do número ────────────────────────────────────────────────

/** Nota explicando como ler um número que tem pegadinha (estimativa, fuso…). */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-[6px] bg-[var(--muted-soft)] px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
      {children}
    </p>
  )
}
