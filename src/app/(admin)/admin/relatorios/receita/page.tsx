import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, pct, num, delta } from "@/lib/reports/format"
import {
  getRevenueSummary, getRevenueByMonth, getRevenueByOrigin, getRevenueByMethod,
  getTopStudentsByRevenue, getDeferredRevenue, getPackageSales, concentration,
  ORIGIN_LABEL, ORIGIN_COLOR, type RevenueBasis,
} from "@/lib/reports/revenue"
import { getAttributedBySubject, getAttributedByTeacher } from "@/lib/reports/attribution"
import { SimpleAreaChart } from "@/components/charts/area-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note, Bar } from "../ui"
import { BasisToggle } from "./basis-toggle"

export const dynamic = "force-dynamic"

export default async function ReceitaPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams & { base?: string }>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const basis: RevenueBasis = sp.base === "vencimento" ? "vencimento" : "caixa"
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const chartStart = b.chartPoints[0].start
  const chartEnd   = b.chartPoints[b.chartPoints.length - 1].end

  const [
    summary, prevSummary, byMonth, byOrigin, byMethod,
    topStudents, deferred, packages, bySubject, byTeacher,
  ] = await Promise.all([
    getRevenueSummary(b.start, b.end),
    getRevenueSummary(b.prevStart, b.prevEnd),
    getRevenueByMonth(chartStart, chartEnd, basis),
    getRevenueByOrigin(b.start, b.end),
    getRevenueByMethod(b.start, b.end),
    getTopStudentsByRevenue(b.start, b.end, 10),
    getDeferredRevenue(),
    getPackageSales(b.start, b.end),
    getAttributedBySubject(b.start, b.end),
    getAttributedByTeacher(b.start, b.end),
  ])

  const serie = b.chartPoints.map((p) => ({
    label: p.label,
    value: Math.round(byMonth.get(p.key)?.gross ?? 0),
  }))

  const originData = byOrigin.map((o) => ({
    label: ORIGIN_LABEL[o.origin] ?? o.origin,
    value: Math.round(o.total),
    color: ORIGIN_COLOR[o.origin] ?? "#94a3b8",
  }))

  const conc5      = concentration(topStudents, summary.gross, 5)
  const totalFees  = byMethod.reduce((s, m) => s + m.fees, 0)
  const effective  = summary.gross > 0 ? (totalFees / summary.gross) * 100 : 0
  const topSubject = bySubject[0]

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
      </p>

      <StatGrid cols={4}>
        <Stat label="Receita bruta" value={brlRound(summary.gross)}
          delta={delta(summary.gross, prevSummary.gross)}
          sub={`${num(summary.count)} cobrança${summary.count !== 1 ? "s" : ""} quitada${summary.count !== 1 ? "s" : ""}`} />
        <Stat label="Taxas pagas" value={brlRound(summary.fees)}
          delta={delta(summary.fees, prevSummary.fees, false)}
          sub={`${pct(effective)} de taxa efetiva sobre o recebido`} />
        <Stat label="Receita líquida" value={brlRound(summary.net)}
          delta={delta(summary.net, prevSummary.net)}
          sub="foi o que realmente caiu na conta" />
        <Stat label="Ticket médio" value={brl(summary.ticket)}
          delta={delta(summary.ticket, prevSummary.ticket)}
          sub={`${num(summary.payers)} aluno${summary.payers !== 1 ? "s" : ""} pagante${summary.payers !== 1 ? "s" : ""} no período`} />
      </StatGrid>

      {/* ── Evolução ──────────────────────────────────────────────────────── */}
      <Panel
        title="Evolução da receita"
        subtitle={
          basis === "caixa"
            ? "Agrupada pela data em que o dinheiro entrou"
            : "Agrupada pela data de vencimento — inclui o que ainda não foi pago"
        }
        action={<BasisToggle current={basis} />}
      >
        {serie.some((s) => s.value > 0)
          ? <SimpleAreaChart data={serie} valuePrefix="R$ " height={240} />
          : <Empty label="Nenhuma receita no intervalo do gráfico" />}
        <Note>
          Comparar as duas visões mostra o atraso de recebimento: se a curva de
          &ldquo;vencimento&rdquo; está acima da de &ldquo;recebido&rdquo; no mês, sobrou
          cobrança em aberto naquele mês.
        </Note>
      </Panel>

      {/* ── Origem e método ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="De onde vem a receita" subtitle="Pacotes, turmas, aulões e cobranças avulsas">
          {originData.length === 0 ? (
            <Empty label="Nenhum pagamento no período" />
          ) : (
            <>
              <DonutChart data={originData} height={220} />
              <Table>
                <tbody>
                  {byOrigin.map((o) => (
                    <tr key={o.origin} className="border-t border-border first:border-0">
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: ORIGIN_COLOR[o.origin] }} />
                          {ORIGIN_LABEL[o.origin]}
                        </span>
                      </Td>
                      <Td align="right" mono className="text-muted-foreground">{o.count}</Td>
                      <Td align="right" mono>{brl(o.total)}</Td>
                      <Td align="right" mono className="text-muted-foreground">
                        {summary.gross > 0 ? pct((o.total / summary.gross) * 100, 0) : "–"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Note>
                O aulão não tem vínculo no banco entre cobrança e aula — a classificação usa o
                texto da descrição. Cobranças criadas à mão caem em &ldquo;avulsas&rdquo;.
              </Note>
            </>
          )}
        </Panel>

        <Panel
          title="Por forma de pagamento"
          subtitle="A coluna de taxa efetiva mostra quanto cada meio de recebimento custa"
        >
          {byMethod.length === 0 ? (
            <Empty label="Nenhum pagamento no período" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Forma</Th>
                  <Th align="right">Nº</Th>
                  <Th align="right">Recebido</Th>
                  <Th align="right">Taxa</Th>
                  <Th align="right">Efetiva</Th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map((m) => (
                  <tr key={m.method} className="border-t border-border">
                    <Td className="font-medium">{m.method}</Td>
                    <Td align="right" mono className="text-muted-foreground">{m.count}</Td>
                    <Td align="right" mono>{brl(m.total)}</Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(m.fees)}</Td>
                    <Td align="right" mono
                      className={m.effectivePct > 4 ? "text-[var(--danger)]" : m.effectivePct > 0 ? "text-[var(--warn)]" : "text-[var(--success)]"}>
                      {pct(m.effectivePct)}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-[var(--muted-soft)]">
                  <Td className="font-semibold">Total</Td>
                  <Td align="right" mono>{summary.count}</Td>
                  <Td align="right" mono className="font-semibold">{brl(summary.gross)}</Td>
                  <Td align="right" mono>{brl(summary.fees)}</Td>
                  <Td align="right" mono className="font-semibold">{pct(effective)}</Td>
                </tr>
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      {/* ── Concentração ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Quem mais paga"
          subtitle={
            topStudents.length > 0
              ? `Os 5 maiores concentram ${pct(conc5, 0)} da receita do período`
              : "Sem pagamentos no período"
          }
        >
          {topStudents.length === 0 ? (
            <Empty label="Nenhum pagamento no período" />
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {topStudents.map((s, i) => (
                  <li key={s.studentId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px]">
                        <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{i + 1}.</span>
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground">RA {s.ra}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[12px]" style={{ fontFeatureSettings: '"tnum"' }}>
                        {brl(s.total)}
                      </span>
                    </div>
                    <Bar ratio={topStudents[0].total > 0 ? s.total / topStudents[0].total : 0} />
                  </li>
                ))}
              </ul>
              {conc5 > 40 && (
                <Note>
                  Concentração alta: perder um único desses alunos derruba{" "}
                  {pct(topStudents[0] && summary.gross > 0 ? (topStudents[0].total / summary.gross) * 100 : 0, 0)}{" "}
                  do faturamento do período.
                </Note>
              )}
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Passivo de aulas" subtitle="Dinheiro já recebido que ainda é aula a entregar">
            <div className="flex items-end justify-between gap-3">
              <span className="font-mono text-[26px] font-semibold leading-none" style={{ fontFeatureSettings: '"tnum"' }}>
                {brlRound(deferred.total)}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {num(Math.round(deferred.lessons))} aulas · {deferred.students} aluno{deferred.students !== 1 ? "s" : ""}
              </span>
            </div>
            <Note>
              Um mês forte de vendas de pacote infla o caixa e o passivo ao mesmo tempo. Essas
              aulas ainda vão custar professor lá na frente.
            </Note>
          </Panel>

          <Panel title="Pacotes vendidos no período" subtitle="Pela data de compra do pacote">
            {packages.count === 0 ? (
              <Empty label="Nenhum pacote vendido" />
            ) : (
              <Table>
                <tbody>
                  <tr><Td>Pacotes vendidos</Td><Td align="right" mono>{packages.count}</Td></tr>
                  <tr className="border-t border-border">
                    <Td>Valor contratado</Td><Td align="right" mono>{brl(packages.value)}</Td>
                  </tr>
                  <tr className="border-t border-border">
                    <Td>Ticket médio por pacote</Td><Td align="right" mono>{brl(packages.avgTicket)}</Td>
                  </tr>
                  <tr className="border-t border-border">
                    <Td>Preço médio por aula</Td><Td align="right" mono>{brl(packages.avgPerLesson)}</Td>
                  </tr>
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Matéria e professor ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Receita por matéria"
          subtitle={topSubject ? `${topSubject.label} lidera com ${brl(topSubject.revenue)}` : "Receita atribuída às aulas realizadas"}
        >
          {bySubject.length === 0 ? (
            <Empty label="Nenhuma aula realizada no período" />
          ) : (
            <SimpleBarChart
              data={bySubject.slice(0, 8).map((s) => ({ label: s.label, value: Math.round(s.revenue) }))}
              color="#219EBC"
              valuePrefix="R$ "
              height={240}
              horizontal
            />
          )}
        </Panel>

        <Panel title="Receita por professor" subtitle="Receita atribuída às aulas realizadas">
          {byTeacher.length === 0 ? (
            <Empty label="Nenhuma aula realizada no período" />
          ) : (
            <SimpleBarChart
              data={byTeacher.slice(0, 8).map((s) => ({
                label: s.label.split(" ")[0],
                value: Math.round(s.revenue),
              }))}
              valuePrefix="R$ "
              height={240}
              horizontal
            />
          )}
        </Panel>
      </div>
    </div>
  )
}
