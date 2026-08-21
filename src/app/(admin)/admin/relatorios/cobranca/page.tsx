import Link from "next/link"
import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, pct, num } from "@/lib/reports/format"
import {
  getReceivables, getAging, getDebtors, getRecovery, getOverdueByMonth,
} from "@/lib/reports/receivables"
import { getRevenueSummary } from "@/lib/reports/revenue"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note, Bar } from "../ui"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function CobrancaPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const chartStart = b.chartPoints[0].start
  const chartEnd   = b.chartPoints[b.chartPoints.length - 1].end

  const [receivables, aging, debtors, recovery, overdueByMonth, revenue] = await Promise.all([
    getReceivables(now),
    getAging(now),
    getDebtors(now, 50),
    getRecovery(b.start, b.end),
    getOverdueByMonth(chartStart, chartEnd),
    getRevenueSummary(b.start, b.end),
  ])

  const overduePct = revenue.gross > 0 ? (receivables.overdueTotal / revenue.gross) * 100 : 0
  const agingChart = aging
    .filter((a) => a.total > 0)
    .map((a) => ({ label: a.label, value: Math.round(a.total), color: a.color }))

  const evolution = b.chartPoints.map((p) => ({
    label: p.label,
    value: Math.round(overdueByMonth.get(p.key) ?? 0),
  }))

  const worst = debtors[0]

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Saldos em aberto na data de hoje · recuperação medida em{" "}
        <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
      </p>

      <StatGrid cols={4}>
        <Stat label="Total em aberto" value={brlRound(receivables.openTotal)}
          sub={`${num(receivables.pendingCount + receivables.overdueCount)} cobranças não pagas`} />
        <Stat label="A vencer" value={brlRound(receivables.pendingTotal)}
          sub={`${num(receivables.pendingCount)} cobrança${receivables.pendingCount !== 1 ? "s" : ""} dentro do prazo`} />
        <Stat label="Vencido" value={brlRound(receivables.overdueTotal)}
          sub={`${num(receivables.overdueCount)} cobranças · ${receivables.overdueStudents} aluno${receivables.overdueStudents !== 1 ? "s" : ""}`}
          tone={receivables.overdueTotal > 0 ? "negative" : undefined} />
        <Stat label="Peso da inadimplência" value={pct(overduePct, 0)}
          sub="vencido em relação ao recebido no período"
          tone={overduePct > 15 ? "negative" : overduePct === 0 ? "positive" : undefined} />
      </StatGrid>

      <Note>
        Aqui &ldquo;vencido&rdquo; é toda cobrança não paga cuja data já passou — não apenas as
        que alguém marcou manualmente como vencidas. Por isso este número costuma ser maior que
        o de <Link href="/admin/financeiro" className="underline">/admin/financeiro</Link>, que
        soma só o status <code>OVERDUE</code>. O correto é este.
      </Note>

      {/* ── Aging ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Envelhecimento dos recebíveis"
          subtitle="Quanto mais velha a dívida, menor a chance de entrar"
        >
          {agingChart.length === 0 ? (
            <Empty label="Nada em aberto" hint="Todas as cobranças estão quitadas." />
          ) : (
            <>
              <SimpleBarChart data={agingChart} valuePrefix="R$ " height={220} />
              <Table>
                <tbody>
                  {aging.map((a) => (
                    <tr key={a.id} className="border-t border-border first:border-0">
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                          {a.label}
                        </span>
                      </Td>
                      <Td align="right" mono className="text-muted-foreground">{a.count}</Td>
                      <Td align="right" mono>{brl(a.total)}</Td>
                      <Td align="right" mono className="text-muted-foreground">
                        {receivables.openTotal > 0 ? pct((a.total / receivables.openTotal) * 100, 0) : "–"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Panel>

        <Panel
          title="Recuperação de atrasados"
          subtitle={`Cobranças quitadas em ${b.periodLabel.toLowerCase()}`}
        >
          {recovery.lateCount + recovery.onTimeCount === 0 ? (
            <Empty label="Nenhuma cobrança quitada no período" />
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-muted-foreground">Pago em dia</span>
                  <span className="font-mono" style={{ fontFeatureSettings: '"tnum"' }}>
                    {brl(recovery.onTimeTotal)} · {recovery.onTimeCount}
                  </span>
                </div>
                <Bar ratio={1 - recovery.latePct / 100} color="var(--success)" />
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-muted-foreground">Pago com atraso</span>
                  <span className="font-mono" style={{ fontFeatureSettings: '"tnum"' }}>
                    {brl(recovery.lateTotal)} · {recovery.lateCount}
                  </span>
                </div>
                <Bar ratio={recovery.latePct / 100} color="var(--warn)" />
              </div>

              <Table>
                <tbody>
                  <tr>
                    <Td>Fatia recebida com atraso</Td>
                    <Td align="right" mono className="font-semibold">{pct(recovery.latePct)}</Td>
                  </tr>
                  <tr className="border-t border-border">
                    <Td>Atraso médio de quem pagou atrasado</Td>
                    <Td align="right" mono className="font-semibold">
                      {recovery.lateCount > 0 ? `${recovery.avgDelayDays} dias` : "–"}
                    </Td>
                  </tr>
                </tbody>
              </Table>

              <Note>
                Recuperação alta com inadimplência alta é problema de <em>processo</em> — falta
                lembrete, o boleto some. Recuperação baixa é problema de <em>crédito</em>: o
                aluno não vai pagar, e vale rever a política de pagamento antecipado.
              </Note>
            </>
          )}
        </Panel>
      </div>

      {/* ── Evolução ──────────────────────────────────────────────────────── */}
      <Panel
        title="Evolução do que ficou em aberto"
        subtitle="Valor não pago por mês de vencimento — mostra se a bola de neve cresce"
      >
        {evolution.some((e) => e.value > 0)
          ? <SimpleBarChart data={evolution} color="#ef4444" valuePrefix="R$ " height={200} />
          : <Empty label="Nenhuma cobrança em aberto nos meses do gráfico" />}
      </Panel>

      {/* ── Devedores ─────────────────────────────────────────────────────── */}
      <Panel
        title="Quem está devendo"
        subtitle={
          worst
            ? `Mais antigo: ${worst.name}, ${worst.oldestDays} dias de atraso`
            : "Ninguém em atraso"
        }
        action={
          <Link href="/admin/financeiro/pagamentos?filter=OVERDUE"
            className="text-[11px] text-muted-foreground hover:text-[var(--text)]">
            Gerenciar cobranças →
          </Link>
        }
      >
        {debtors.length === 0 ? (
          <Empty label="Nenhum aluno em atraso" hint="Todas as cobranças vencidas foram quitadas." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Aluno</Th>
                <Th>Contato</Th>
                <Th align="right">Cobranças</Th>
                <Th align="right">Atraso</Th>
                <Th align="right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.studentId} className="border-t border-border">
                  <Td>
                    <span className="font-medium">{d.name}</span>
                    <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground">RA {d.ra}</span>
                    {d.guardianName && (
                      <span className="block text-[10.5px] text-muted-foreground">
                        responsável: {d.guardianName}
                      </span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{d.phone ?? d.email ?? "—"}</Td>
                  <Td align="right" mono className="text-muted-foreground">{d.count}</Td>
                  <Td align="right">
                    <span
                      className="inline-flex items-center rounded px-[6px] py-px font-mono text-[11px] font-semibold"
                      style={
                        d.oldestDays >= 60 ? { background: "var(--danger-soft)", color: "var(--danger)" }
                        : d.oldestDays >= 15 ? { background: "var(--warn-soft)", color: "var(--warn)" }
                        : { background: "var(--muted-soft)", color: "var(--subtle)" }
                      }
                    >
                      {d.oldestDays}d
                    </span>
                  </Td>
                  <Td align="right" mono className={cn("font-semibold", d.oldestDays >= 60 && "text-[var(--danger)]")}>
                    {brl(d.total)}
                  </Td>
                </tr>
              ))}
              <tr className="border-t border-border bg-[var(--muted-soft)]">
                <Td className="font-semibold">Total</Td>
                <Td />
                <Td align="right" mono>{receivables.overdueCount}</Td>
                <Td />
                <Td align="right" mono className="font-semibold">{brl(receivables.overdueTotal)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
