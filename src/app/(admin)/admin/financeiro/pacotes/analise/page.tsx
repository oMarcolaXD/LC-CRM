import { prisma }     from "@/lib/prisma"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { BarChart3, Package, TrendingUp, Trophy } from "lucide-react"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function fmtLessons(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",") }

export default async function PacotesAnalisePage() {
  const packages = await prisma.lessonPackage.findMany({
    select: { totalLessons: true, pricePerLesson: true, purchaseDate: true },
  })

  // Agrupa por tamanho de pacote (nº de aulas)
  const bySize = new Map<number, { count: number; revenue: number }>()
  for (const p of packages) {
    const size    = Number(p.totalLessons)
    const revenue = size * Number(p.pricePerLesson)
    const cur = bySize.get(size) ?? { count: 0, revenue: 0 }
    cur.count   += 1
    cur.revenue += revenue
    bySize.set(size, cur)
  }

  const sizes = [...bySize.entries()]
    .map(([size, v]) => ({
      size,
      count:   v.count,
      revenue: v.revenue,
      ticket:  v.revenue / v.count,
    }))
    .sort((a, b) => a.size - b.size)

  const totalPacotes = packages.length
  const totalReceita = sizes.reduce((s, r) => s + r.revenue, 0)
  const mostSold     = [...sizes].sort((a, b) => b.count - a.count)[0]

  const freqData    = sizes.map((r) => ({ label: `${fmtLessons(r.size)}`, value: r.count }))
  const revenueData = sizes.map((r) => ({ label: `${fmtLessons(r.size)}`, value: Math.round(r.revenue) }))

  const kpis = [
    { title: "Pacotes vendidos", value: String(totalPacotes),                       icon: Package,    cls: "text-primary" },
    { title: "Receita em pacotes", value: brl(totalReceita),                         icon: TrendingUp, cls: "text-green-600" },
    { title: "Mais vendido",     value: mostSold ? `${fmtLessons(mostSold.size)} aulas` : "—", icon: Trophy, cls: "text-secondary" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="ANÁLISE DE PACOTES"
        description="Quais tamanhos de pacote mais vendem e quanto geram"
        backHref="/admin/financeiro/pacotes"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(({ title, value, icon: Icon, cls }) => (
          <Card key={title}>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
                <p className="text-lg font-bold font-sub mt-1">{value}</p>
              </div>
              <Icon className={`w-5 h-5 ${cls}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPacotes === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum pacote registrado ainda.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Frequência por tamanho (nº de pacotes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={freqData} height={220} />
                <p className="text-xs text-muted-foreground text-center mt-1">aulas por pacote</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-secondary" /> Receita por tamanho
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={revenueData} height={220} color="#219EBC" valuePrefix="R$ " />
                <p className="text-xs text-muted-foreground text-center mt-1">aulas por pacote</p>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base">Detalhamento por tamanho</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="py-2 pr-3 font-medium">Tamanho</th>
                      <th className="py-2 pr-3 font-medium text-right">Vendidos</th>
                      <th className="py-2 pr-3 font-medium text-right">% do total</th>
                      <th className="py-2 pr-3 font-medium text-right">Receita</th>
                      <th className="py-2 font-medium text-right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sizes].sort((a, b) => b.count - a.count).map((r) => (
                      <tr key={r.size} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-medium">{fmtLessons(r.size)} aulas</td>
                        <td className="py-2 pr-3 text-right">{r.count}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {Math.round((r.count / totalPacotes) * 100)}%
                        </td>
                        <td className="py-2 pr-3 text-right">{brl(r.revenue)}</td>
                        <td className="py-2 text-right">{brl(r.ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
