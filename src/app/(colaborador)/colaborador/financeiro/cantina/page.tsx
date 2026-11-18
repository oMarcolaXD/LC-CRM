import Link              from "next/link"
import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { LinkButton }    from "@/components/shared/link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBR, parseBrazilDateTime } from "@/lib/datetime"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]

/** Soma de dias numa data "YYYY-MM-DD" sem passar por fuso. */
function somaDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Quanto a cantina rendeu. Fica fora de Payment (receita de aulas), então
 * estes números não aparecem — nem se misturam — nos relatórios de aulas.
 * "Recebido" conta pelo dia em que o dinheiro entrou; fiado só conta quando é pago.
 */
export default async function CantinaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: rawMes } = await searchParams
  const hoje   = formatBR(new Date(), "yyyy-MM-dd")
  const mes    = /^\d{4}-\d{2}$/.test(rawMes ?? "") ? rawMes! : hoje.slice(0, 7)
  const [ano, m] = mes.split("-").map(Number)
  const proxMes  = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`
  const antMes   = m === 1  ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`

  const inicioMes  = parseBrazilDateTime(`${mes}-01`, "00:00")
  const fimMes     = parseBrazilDateTime(`${proxMes}-01`, "00:00")
  const inicioHoje = parseBrazilDateTime(hoje, "00:00")
  const fimHoje    = parseBrazilDateTime(somaDias(hoje, 1), "00:00")
  // Semana começando na segunda-feira
  const dow        = new Date(`${hoje}T12:00:00Z`).getUTCDay()           // 0 = domingo
  const inicioSem  = parseBrazilDateTime(somaDias(hoje, -((dow + 6) % 7)), "00:00")

  const somaPago = (de: Date, ate: Date) => prisma.canteenSale.aggregate({
    where: { status: "PAID", paidAt: { gte: de, lt: ate } },
    _sum:  { amount: true },
    _count: true,
  })

  const [dia, semana, doMes, fiado, porForma, vendasMes] = await Promise.all([
    somaPago(inicioHoje, fimHoje),
    somaPago(inicioSem, fimHoje),
    somaPago(inicioMes, fimMes),
    prisma.canteenSale.findMany({
      where:   { status: "PENDING" },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { soldAt: "asc" },
    }),
    prisma.canteenSale.groupBy({
      by:    ["method"],
      where: { status: "PAID", paidAt: { gte: inicioMes, lt: fimMes } },
      _sum:  { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.canteenSale.findMany({
      where:   { soldAt: { gte: inicioMes, lt: fimMes } },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    }),
  ])

  const totalFiado = fiado.reduce((s, v) => s + Number(v.amount), 0)
  const nomeMes    = `${MESES[m - 1]} de ${ano}`

  const cards = [
    { label: "Recebido hoje",        valor: Number(dia._sum.amount ?? 0),    sub: `${dia._count} venda(s)` },
    { label: "Recebido na semana",   valor: Number(semana._sum.amount ?? 0),  sub: `${semana._count} venda(s)` },
    { label: `Recebido em ${MESES[m - 1]}`, valor: Number(doMes._sum.amount ?? 0), sub: `${doMes._count} venda(s)` },
    { label: "Fiado em aberto",      valor: totalFiado,                       sub: `${fiado.length} item(ns)`, alerta: totalFiado > 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="CANTINA" description="Quanto a cantina rendeu — separado da receita das aulas" backHref="/colaborador/financeiro">
        <LinkButton href="/colaborador/financeiro/lancar" size="sm">Lançar</LinkButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className={c.alerta ? "border-destructive/40" : ""}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className={`mt-1 text-lg font-bold ${c.alerta ? "text-destructive" : ""}`}>{brl(c.valor)}</p>
              <p className="text-[11px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-sub flex flex-wrap items-center justify-between gap-2 text-base">
              <span>Vendas de {nomeMes}</span>
              <span className="flex items-center gap-1 text-xs font-normal">
                <Link href={`?mes=${antMes}`} className="rounded-md border border-input px-2 py-1 hover:bg-muted">← mês anterior</Link>
                {mes !== hoje.slice(0, 7) && <Link href={`?mes=${proxMes}`} className="rounded-md border border-input px-2 py-1 hover:bg-muted">próximo mês →</Link>}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendasMes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda da cantina neste mês.</p>
            ) : (
              <div className="divide-y text-sm">
                {vendasMes.map((v) => (
                  <div key={v.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/colaborador/alunos/${v.student.id}`} className="font-medium hover:underline">{v.student.name}</Link>
                      <p className="text-xs text-muted-foreground break-words">
                        {formatBR(v.soldAt, "dd/MM")} · {v.description} · {v.status === "PENDING"
                          ? <span className="font-semibold text-destructive">fiado</span>
                          : <>{v.method}</>}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{brl(Number(v.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-sub text-base">Por forma de pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {porForma.length === 0 && <p className="text-xs text-muted-foreground">Nada recebido neste mês.</p>}
              {porForma.map((f) => (
                <div key={f.method ?? "-"} className="flex justify-between">
                  <span>{f.method ?? "Sem forma"}</span>
                  <span className="font-semibold tabular-nums">{brl(Number(f._sum.amount ?? 0))}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-sub text-base">Fiado em aberto</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {fiado.length === 0 && <p className="text-xs text-muted-foreground">Ninguém devendo. 🎉</p>}
              {fiado.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/colaborador/alunos/${v.student.id}`} className="font-medium hover:underline">{v.student.name}</Link>
                    <p className="text-[11px] text-muted-foreground">{v.description} · desde {formatBR(v.soldAt, "dd/MM")}</p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-destructive">{brl(Number(v.amount))}</span>
                </div>
              ))}
              {fiado.length > 0 && <p className="pt-1 text-[11px] text-muted-foreground">Para receber, abra o perfil do aluno → Cantina → &ldquo;Receber fiado&rdquo;.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
