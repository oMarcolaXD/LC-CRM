import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, num } from "@/lib/reports/format"
import { getCashFlow, getProjection, getUpcoming } from "@/lib/reports/cashflow"
import { CashFlowChart } from "@/components/charts/cash-flow-chart"
import { SimpleAreaChart } from "@/components/charts/area-chart"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note } from "../ui"
import { format, differenceInCalendarDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const [flow, projection, upcoming] = await Promise.all([
    getCashFlow(b.chartPoints),
    getProjection(now, 90),
    getUpcoming(now, 45, 30),
  ])

  const chartData = flow.months.map((m) => ({
    label:     m.label,
    entradas:  Math.round(m.inflow),
    saidas:    -Math.round(m.outflow),
    acumulado: Math.round(m.running),
  }))

  const projectionSeries = projection.weeks.map((w) => ({
    label: w.label,
    value: Math.round(w.running),
  }))

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
        {" · "}tudo pela data em que o dinheiro se move, não por competência
      </p>

      <StatGrid cols={4}>
        <Stat label="Entrou" value={brlRound(flow.totalIn)}
          sub="pagamentos quitados no intervalo do gráfico"
          spark={flow.months.map((m) => m.inflow)} sparkColor="var(--primary)" />
        <Stat label="Saiu" value={brlRound(flow.totalOut)}
          sub="repasses pagos + despesas quitadas"
          spark={flow.months.map((m) => m.outflow)} sparkColor="var(--danger)" />
        <Stat label="Resultado de caixa" value={brlRound(flow.net)}
          sub={flow.net >= 0 ? "sobrou dinheiro no período" : "queimou caixa no período"}
          tone={flow.net >= 0 ? "positive" : "negative"}
          spark={flow.months.map((m) => m.running)}
          sparkColor={flow.net >= 0 ? "var(--success)" : "var(--danger)"} />
        <Stat label="Previsto em 90 dias" value={brlRound(projection.net)}
          sub={`${brl(projection.totalIn)} a receber − ${brl(projection.totalOut)} a pagar`}
          tone={projection.net >= 0 ? "positive" : "negative"} />
      </StatGrid>

      {projection.firstNegative && (
        <div
          className="flex items-start gap-2.5 rounded-[6px] px-3 py-[9px]"
          style={{ background: "var(--danger-soft)", borderLeft: "2px solid var(--danger)" }}
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "var(--danger)" }} />
          <span className="text-[12.5px] leading-[1.35]" style={{ color: "var(--text)" }}>
            Pela projeção, o caixa fica negativo a partir da semana de{" "}
            <strong>{format(projection.firstNegative.start, "dd 'de' MMMM", { locale: ptBR })}</strong>{" "}
            ({brl(projection.firstNegative.running)} acumulado). Antecipar cobranças ou adiar
            uma despesa resolve.
          </span>
        </div>
      )}

      {/* ── Realizado ─────────────────────────────────────────────────────── */}
      <Panel
        title="Caixa realizado"
        subtitle="Barras acima = entradas · abaixo = saídas · linha = acumulado da série"
      >
        {flow.totalIn === 0 && flow.totalOut === 0 ? (
          <Empty label="Nenhum movimento de caixa no intervalo" />
        ) : (
          <>
            <CashFlowChart data={chartData} />
            <Table>
              <thead>
                <tr>
                  <Th>Mês</Th>
                  <Th align="right">Entradas</Th>
                  <Th align="right">Professores</Th>
                  <Th align="right">Despesas</Th>
                  <Th align="right">Resultado</Th>
                  <Th align="right">Acumulado</Th>
                </tr>
              </thead>
              <tbody>
                {flow.months.map((m) => (
                  <tr key={m.key} className="border-t border-border">
                    <Td className="font-medium">{m.label}</Td>
                    <Td align="right" mono>{brl(m.inflow)}</Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(m.teacherOutflow)}</Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(m.expenseOutflow)}</Td>
                    <Td align="right" mono className={m.net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {brl(m.net)}
                    </Td>
                    <Td align="right" mono className="font-semibold">{brl(m.running)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              O acumulado começa em zero no primeiro mês do gráfico — é a variação de caixa do
              período, não o saldo da conta bancária. A taxa de cartão não aparece como saída
              porque já vem descontada do valor depositado.
            </Note>
          </>
        )}
      </Panel>

      {/* ── Projeção ──────────────────────────────────────────────────────── */}
      <Panel
        title="Projeção de 90 dias"
        subtitle="Semana a semana: cobranças a vencer contra despesas e repasse estimado"
      >
        {projection.weeks.length === 0 ? (
          <Empty label="Nada previsto para os próximos 90 dias" />
        ) : (
          <>
            <SimpleAreaChart
              data={projectionSeries}
              valuePrefix="R$ "
              height={200}
              color={projection.net >= 0 ? "#10b981" : "#ef4444"}
            />
            <Table>
              <thead>
                <tr>
                  <Th>Semana de</Th>
                  <Th align="right">A receber</Th>
                  <Th align="right">A pagar</Th>
                  <Th align="right">Saldo da semana</Th>
                  <Th align="right">Acumulado</Th>
                </tr>
              </thead>
              <tbody>
                {projection.weeks.map((w) => (
                  <tr key={w.label} className="border-t border-border">
                    <Td className="whitespace-nowrap font-medium">
                      {format(w.start, "dd/MM", { locale: ptBR })}
                      {w.overdueIncluded && (
                        <span className="ml-1.5 rounded px-1 py-px text-[9.5px] font-semibold uppercase"
                          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                          inclui vencido
                        </span>
                      )}
                    </Td>
                    <Td align="right" mono>{w.inflow > 0 ? brl(w.inflow) : "–"}</Td>
                    <Td align="right" mono className="text-muted-foreground">
                      {w.outflow > 0 ? brl(w.outflow) : "–"}
                    </Td>
                    <Td align="right" mono className={w.net >= 0 ? "" : "text-[var(--danger)]"}>
                      {brl(w.net)}
                    </Td>
                    <Td align="right" mono
                      className={cn("font-semibold", w.running < 0 && "text-[var(--danger)]")}>
                      {brl(w.running)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              A projeção é otimista por construção: assume que <strong>todo</strong> valor em
              aberto será recebido, inclusive {brl(projection.overdue)} que já venceu e foi
              empurrado para a primeira semana. O repasse de professor futuro não existe como
              registro até ser pago, então entra como estimativa (média dos últimos meses).
            </Note>
          </>
        )}
      </Panel>

      {/* ── Agenda ────────────────────────────────────────────────────────── */}
      <Panel
        title="Agenda financeira"
        subtitle="Próximos 45 dias, entradas e saídas em ordem de data"
      >
        {upcoming.length === 0 ? (
          <Empty label="Nada agendado para os próximos 45 dias" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th />
                <Th>Descrição</Th>
                <Th align="right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((u) => {
                const days = differenceInCalendarDays(u.date, now)
                return (
                  <tr key={`${u.kind}-${u.id}`} className="border-t border-border">
                    <Td className="whitespace-nowrap">
                      <span className="font-mono" style={{ fontFeatureSettings: '"tnum"' }}>
                        {format(u.date, "dd/MM", { locale: ptBR })}
                      </span>
                      <span className={cn(
                        "ml-1.5 text-[10.5px]",
                        u.late ? "text-[var(--danger)]" : "text-muted-foreground",
                      )}>
                        {u.late ? `${Math.abs(days)}d atrás` : days === 0 ? "hoje" : `em ${days}d`}
                      </span>
                    </Td>
                    <Td>
                      {u.kind === "entrada"
                        ? <ArrowUpRight className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
                        : <ArrowDownRight className="h-3.5 w-3.5" style={{ color: "var(--danger)" }} />}
                    </Td>
                    <Td>
                      <span className="font-medium">{u.label}</span>
                      <span className="ml-1.5 text-muted-foreground">{u.detail}</span>
                    </Td>
                    <Td align="right" mono
                      className={u.kind === "entrada" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {u.kind === "entrada" ? "+" : "−"}{brl(u.amount)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <Note>
          {num(upcoming.filter((u) => u.late).length)} item(ns) já com data no passado — são os
          que precisam de ação hoje.
        </Note>
      </Panel>
    </div>
  )
}
