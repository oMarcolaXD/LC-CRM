import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, pct, num, delta } from "@/lib/reports/format"
import {
  getStudentBase, getChurn, getStudentValue, getCohorts,
  getCreditBalances, joinLeaveSeries,
} from "@/lib/reports/students"
import { getRevenueSummary, getTopStudentsByRevenue, concentration } from "@/lib/reports/revenue"
import { Heatmap, type HeatRow } from "@/components/charts/heatmap"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note, Bar } from "../ui"

export const dynamic = "force-dynamic"

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const base    = await getStudentBase(now)
  const [revenue, prevRevenue, churn, cohorts, credits, topStudents] = await Promise.all([
    getRevenueSummary(b.start, b.end),
    getRevenueSummary(b.prevStart, b.prevEnd),
    getChurn(b.chartPoints[0].start, b.chartPoints[b.chartPoints.length - 1].end, now, base.active),
    getCohorts(now, 12),
    getCreditBalances(15),
    getTopStudentsByRevenue(b.start, b.end, 10),
  ])
  const value = await getStudentValue(revenue.gross, base.active)

  const flowSeries = joinLeaveSeries(b.chartPoints, churn)
  const conc5      = concentration(topStudents, revenue.gross, 5)

  const cohortColumns = Array.from({ length: cohorts.maxOffset + 1 }, (_, i) => `M${i}`)
  const cohortRows: HeatRow[] = cohorts.rows.map((r) => ({
    label:    r.label,
    sublabel: `${r.size}`,
    cells: r.values.map((v, i) => ({
      value: v,
      label: v == null ? "" : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)),
      title: v == null
        ? "ainda não viveu este mês"
        : `Coorte ${r.label} · mês ${i}: ${brl(v)} acumulados por aluno`,
    })),
  }))

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
        {" · "}ativo = teve aula nos últimos 60 dias ou tem crédito em pacote
      </p>

      <StatGrid cols={4}>
        <Stat label="Alunos ativos" value={num(base.active)}
          sub={`de ${num(base.total)} cadastrados · ${num(base.inactive)} inativos`} />
        <Stat label="Entraram" value={num(churn.joined)}
          sub="cadastros novos no intervalo do gráfico"
          spark={flowSeries.map((s) => s.entrada)} sparkColor="var(--success)" />
        <Stat label="Pararam" value={num(churn.lost)}
          sub={`${pct(churn.churnPct, 1)} da base ativa · sem aula há mais de 60 dias`}
          tone={churn.lost > churn.joined ? "negative" : undefined}
          spark={flowSeries.map((s) => s.saida)} sparkColor="var(--danger)" />
        <Stat label="Saldo" value={`${churn.net >= 0 ? "+" : ""}${num(churn.net)}`}
          sub={churn.net >= 0 ? "a base cresceu no intervalo" : "a base encolheu no intervalo"}
          tone={churn.net >= 0 ? "positive" : "negative"} />
      </StatGrid>

      <StatGrid cols={4}>
        <Stat label="ARPU" value={brl(value.arpu)}
          delta={delta(revenue.gross, prevRevenue.gross)}
          sub="receita do período ÷ alunos ativos" />
        <Stat label="LTV médio" value={brlRound(value.ltv)}
          sub={`média histórica de ${num(value.buyers)} aluno${value.buyers !== 1 ? "s" : ""} que já pagaram`} />
        <Stat label="Recompra" value={pct(value.repeatPct, 0)}
          sub={`${num(value.repeaters)} de ${num(value.buyers)} compraram 2º pacote`} />
        <Stat label="Intervalo entre pacotes" value={
            value.daysBetweenPackages > 0 ? `${value.daysBetweenPackages} dias` : "–"
          }
          sub={
            value.lifespanMonths > 0
              ? `vida média de ${value.lifespanMonths.toFixed(1).replace(".", ",")} meses`
              : "sem histórico suficiente"
          } />
      </StatGrid>

      {/* ── Entradas × saídas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Entradas de alunos" subtitle="Cadastros novos por mês">
          {flowSeries.some((s) => s.entrada > 0)
            ? <SimpleBarChart
                data={flowSeries.map((s) => ({ label: s.label, value: s.entrada }))}
                color="#10b981" height={220} />
            : <Empty label="Nenhum cadastro novo no intervalo" />}
        </Panel>

        <Panel
          title="Alunos que pararam"
          subtitle="Mês da última aula de quem hoje está inativo e sem crédito"
        >
          {flowSeries.some((s) => s.saida > 0)
            ? <SimpleBarChart
                data={flowSeries.map((s) => ({ label: s.label, value: s.saida }))}
                color="#ef4444" height={220} />
            : <Empty label="Nenhum aluno perdido no intervalo" hint="Toda a base seguiu tendo aula." />}
        </Panel>
      </div>

      {/* ── Coortes ───────────────────────────────────────────────────────── */}
      <Panel
        title="Coortes de entrada"
        subtitle="Receita acumulada por aluno, por mês de vida. Linha = mês em que entrou; coluna M0 = mês de entrada"
      >
        {cohortRows.length === 0 ? (
          <Empty label="Sem alunos cadastrados nos últimos 12 meses" />
        ) : (
          <>
            <Heatmap columns={cohortColumns} rows={cohortRows} peak={cohorts.peak} />
            <Note>
              O número ao lado do mês é o tamanho da coorte. Células cinzas são meses que a
              coorte ainda não viveu. Se as linhas mais recentes estão mais claras que as
              antigas na mesma coluna, os alunos novos estão rendendo menos que os de antes —
              vale olhar preço de entrada e conversão para pacote maior.
            </Note>
          </>
        )}
      </Panel>

      {/* ── Concentração e créditos ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Concentração de receita"
          subtitle={
            topStudents.length > 0
              ? `Os 5 maiores respondem por ${pct(conc5, 0)} do período`
              : "Sem pagamentos no período"
          }
        >
          {topStudents.length === 0 ? (
            <Empty label="Nenhum pagamento no período" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {topStudents.map((s) => (
                <li key={s.studentId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium">{s.name}</span>
                    <span className="shrink-0 font-mono text-[12px]" style={{ fontFeatureSettings: '"tnum"' }}>
                      {brl(s.total)}
                    </span>
                  </div>
                  <Bar ratio={topStudents[0].total > 0 ? s.total / topStudents[0].total : 0} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Maiores saldos de crédito"
          subtitle="Aulas já pagas e ainda não usadas — obrigação a entregar"
        >
          {credits.length === 0 ? (
            <Empty label="Nenhum pacote com saldo" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Aluno</Th>
                  <Th align="right">Aulas</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.studentId} className="border-t border-border">
                    <Td>
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground">RA {c.ra}</span>
                    </Td>
                    <Td align="right" mono>{c.lessons.toFixed(1).replace(".", ",")}</Td>
                    <Td align="right" mono>{brl(c.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      {/* ── Base ──────────────────────────────────────────────────────────── */}
      <Panel title="Composição da base" subtitle="Onde estão os alunos cadastrados hoje">
        <Table>
          <tbody>
            <BaseRow label="Ativos (aula recente ou crédito)" value={base.active} total={base.total} color="var(--success)" />
            <BaseRow label="Com crédito em pacote" value={base.withCredits} total={base.total} color="var(--primary)" />
            <BaseRow label="Inativos (sem aula há mais de 60 dias)" value={base.inactive} total={base.total} color="var(--warn)" />
            <BaseRow label="Nunca tiveram aula nem pacote" value={base.never} total={base.total} color="var(--subtle)" />
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}

function BaseRow({
  label, value, total, color,
}: {
  label: string; value: number; total: number; color: string
}) {
  return (
    <tr className="border-t border-border first:border-0">
      <Td className="w-[45%]">{label}</Td>
      <Td>
        <Bar ratio={total > 0 ? value / total : 0} color={color} />
      </Td>
      <Td align="right" mono className="w-[70px] font-semibold">{value}</Td>
      <Td align="right" mono className="w-[60px] text-muted-foreground">
        {total > 0 ? pct((value / total) * 100, 0) : "–"}
      </Td>
    </tr>
  )
}
