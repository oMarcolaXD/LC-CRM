import * as React from "react"
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Caixa de aviso colorida para explicar o estado de algo na própria tela —
 * complementa o toast, que desaparece. Use quando a informação precisa
 * continuar visível (ex: "pacote vencido", "aula aguardando confirmação").
 */

export type AlertTone = "success" | "warning" | "error" | "info"

const TONS: Record<AlertTone, { caixa: string; icone: string; Icon: typeof Info }> = {
  success: {
    caixa: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100",
    icone: "text-emerald-600 dark:text-emerald-400",
    Icon:  CheckCircle2,
  },
  warning: {
    caixa: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
    icone: "text-amber-600 dark:text-amber-400",
    Icon:  AlertTriangle,
  },
  error: {
    caixa: "border-destructive/40 bg-destructive/5 text-foreground",
    icone: "text-destructive",
    Icon:  XCircle,
  },
  info: {
    caixa: "border-[#219EBC]/40 bg-[#219EBC]/5 text-foreground",
    icone: "text-[#219EBC]",
    Icon:  Info,
  },
}

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?:  AlertTone
  /** Linha em negrito no topo. `title` do HTML fica de fora de propósito. */
  title?: React.ReactNode
  /** Substitui o ícone padrão do tom. `null` remove o ícone. */
  icon?:  React.ReactNode | null
  /** Compacto, para caber dentro de diálogos e cards. */
  dense?: boolean
}

export function Alert({
  tone = "info",
  title,
  icon,
  dense = false,
  className,
  children,
  ...props
}: AlertProps) {
  const { caixa, icone, Icon } = TONS[tone]

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border",
        dense ? "px-3 py-2" : "px-4 py-3",
        caixa,
        className,
      )}
      {...props}
    >
      {icon === null ? null : (
        <span className={cn("shrink-0", icone, dense ? "mt-0.5" : "mt-px")}>
          {icon ?? <Icon className={dense ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} />}
        </span>
      )}
      <div className={cn("min-w-0 leading-snug", dense ? "text-[11.5px]" : "text-[13px]")}>
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>
        )}
      </div>
    </div>
  )
}

/**
 * Etiqueta curta para explicar um estado ao lado do próprio dado — o "rótulo
 * explicativo" que ajuda quem não conhece o sistema. Ex: Agendada, Confirmada.
 */
export function StatusTag({
  tone = "info",
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: AlertTone }) {
  const cores: Record<AlertTone, string> = {
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    error:   "bg-destructive/10 text-destructive",
    info:    "bg-[#219EBC]/10 text-[#1a7e96] dark:text-[#4cc3dd]",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        cores[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
