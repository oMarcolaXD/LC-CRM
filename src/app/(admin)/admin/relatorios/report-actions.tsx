"use client"

// Ações do cabeçalho: baixar o recorte atual em CSV e imprimir (o "Salvar como
// PDF" do navegador). Ambos respeitam o período da URL — o CSV reaproveita os
// mesmos módulos de src/lib/reports/ que a tela usa, então os números batem.

import { usePathname, useSearchParams } from "next/navigation"
import { Download, Printer } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"

/** Aba atual → nome do relatório aceito pela rota de export. */
const REPORT_BY_PATH: Record<string, string> = {
  "/admin/relatorios":             "resumo",
  "/admin/relatorios/receita":     "receita",
  "/admin/relatorios/dre":         "dre",
  "/admin/relatorios/caixa":       "caixa",
  "/admin/relatorios/cobranca":    "cobranca",
  "/admin/relatorios/alunos":      "alunos",
  "/admin/relatorios/professores": "professores",
  "/admin/relatorios/qualidade":   "qualidade",
}

export function ReportActions() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const report = REPORT_BY_PATH[pathname] ?? "resumo"
  const params = new URLSearchParams(searchParams)
  params.set("report", report)

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
      </Button>
      {/* <a> puro, não <Link>: o navegador precisa seguir a resposta como download. */}
      <a
        href={`/admin/relatorios/export?${params}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
      </a>
    </div>
  )
}
