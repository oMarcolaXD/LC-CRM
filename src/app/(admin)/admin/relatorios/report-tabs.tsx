"use client"

// Navegação entre as abas de relatório.
//
// Cada aba é uma sub-rota (não estado de cliente), para que o link seja
// compartilhável e a impressão saia da aba certa. O que este componente resolve
// é preservar o período escolhido ao trocar de aba — sem isso, todo clique
// voltaria para "este mês".

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/admin/relatorios",             label: "Visão Geral" },
  { href: "/admin/relatorios/receita",     label: "Receita"     },
  { href: "/admin/relatorios/dre",         label: "DRE / Lucro" },
  { href: "/admin/relatorios/caixa",       label: "Fluxo de Caixa" },
  { href: "/admin/relatorios/cobranca",    label: "Cobrança"    },
  { href: "/admin/relatorios/alunos",      label: "Alunos"      },
  { href: "/admin/relatorios/professores", label: "Professores" },
] as const

export function ReportTabs() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const qs           = searchParams.size ? `?${searchParams}` : ""

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 print:hidden">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={`${t.href}${qs}`}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 py-2 text-[12.5px] font-medium transition-colors",
              active
                ? "text-[var(--text)]"
                : "text-muted-foreground hover:text-[var(--text)]",
            )}
          >
            {t.label}
            {active && (
              <span
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                style={{ background: "var(--primary)" }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
