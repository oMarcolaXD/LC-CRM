import { prisma }     from "@/lib/prisma"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Percent, Info } from "lucide-react"
import { FeeRateManager } from "./fee-rate-manager"

export default async function TaxasPage() {
  const rows = await prisma.cardFeeRate.findMany({
    orderBy: [{ method: "asc" }, { minInstallments: "asc" }],
  })

  const rates = rows.map((r) => ({
    id:              r.id,
    method:          r.method,
    minInstallments: r.minInstallments,
    maxInstallments: r.maxInstallments,
    percent:         Number(r.percent),
    fixed:           Number(r.fixed),
    active:          r.active,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="TAXAS DE CARTÃO"
        description="Configure as taxas das maquininhas por método e faixa de parcelas"
        backHref="/admin/financeiro"
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-secondary" />
          <p>
            As taxas configuradas aqui são aplicadas automaticamente às cobranças (por método e nº de
            parcelas) para calcular a <strong>receita líquida</strong>. O valor da taxa é gravado no
            momento da cobrança — alterar uma regra depois não muda o histórico.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> Regras de Taxa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeeRateManager rates={rates} />
        </CardContent>
      </Card>
    </div>
  )
}
