import Link from "next/link"
import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, pct, num } from "@/lib/reports/format"
import { getTeacherPerformance } from "@/lib/reports/teachers"
import { getLessonStats, getPeakHours, getRoomUsage, DAY_LABEL } from "@/lib/reports/operations"
import { LESSON_TYPE_LABEL, MODALITY_LABEL } from "@/lib/reports/attribution"
import { Heatmap, type HeatRow } from "@/components/charts/heatmap"
import { DonutChart } from "@/components/charts/donut-chart"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note, Bar } from "../ui"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function ProfessoresPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const [report, stats, peak, rooms] = await Promise.all([
    getTeacherPerformance(b.start, b.end),
    getLessonStats(b.start, b.end),
    getPeakHours(b.start, b.end),
    getRoomUsage(b.start, b.end),
  ])

  const negatives = report.rows.filter((r) => r.result < 0 && r.lessons > 0)

  const heatRows: HeatRow[] = peak.grid.map((row, d) => ({
    label: DAY_LABEL[d],
    cells: row.map((count, i) => ({
      value: count,
      label: count > 0 ? String(count) : "",
      title: `${DAY_LABEL[d]} às ${String(peak.hours[i]).padStart(2, "0")}h: ${count} aula${count !== 1 ? "s" : ""}`,
    })),
  }))

  const statusData = [
    { label: "Realizadas", value: stats.completed, color: "#FB8500" },
    { label: "Canceladas", value: stats.cancelled, color: "#ef4444" },
    { label: "Faltas",     value: stats.missed,    color: "#f97316" },
    { label: "Agendadas",  value: stats.scheduled, color: "#8b5cf6" },
    { label: "Confirmadas", value: stats.confirmed, color: "#219EBC" },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
        {" · "}compromissos de agenda ficam fora das contagens de aula
      </p>

      <StatGrid cols={4}>
        <Stat label="Custo com professores" value={brlRound(report.totalCost)}
          sub={`${brl(report.paidOut)} já repassado · ${brl(report.pendingOut)} a repassar`} />
        <Stat label="Receita atribuída" value={brlRound(report.totalRevenue)}
          sub="estimativa das aulas realizadas — ver nota abaixo" />
        <Stat label="Resultado" value={brlRound(report.totalRevenue - report.totalCost)}
          sub={`${pct(report.totalRevenue > 0 ? ((report.totalRevenue - report.totalCost) / report.totalRevenue) * 100 : 0)} de margem sobre a receita atribuída`}
          tone={report.totalRevenue - report.totalCost >= 0 ? "positive" : "negative"} />
        <Stat label="Aulas realizadas" value={num(stats.completed)}
          sub={`${num(Math.round(stats.hours))} h · ${pct(stats.completionPct, 0)} de conclusão`} />
      </StatGrid>

      {negatives.length > 0 && (
        <div
          className="flex items-start gap-2.5 rounded-[6px] px-3 py-[9px]"
          style={{ background: "var(--warn-soft)", borderLeft: "2px solid var(--warn)" }}
        >
          <span className="text-[12.5px] leading-[1.35]" style={{ color: "var(--text)" }}>
            <strong>{negatives.map((n) => n.name).join(", ")}</strong>{" "}
            {negatives.length === 1 ? "custou" : "custaram"} mais do que a receita atribuída às
            aulas {negatives.length === 1 ? "dele" : "deles"} no período. Vale conferir o
            valor/hora contra o preço cobrado do aluno — ou se as aulas foram de cortesia.
          </span>
        </div>
      )}

      {/* ── Quadro por professor ──────────────────────────────────────────── */}
      <Panel
        title="Rentabilidade por professor"
        subtitle="Receita atribuída às aulas menos o custo do repasse"
        action={
          <Link href="/admin/financeiro/professores"
            className="text-[11px] text-muted-foreground hover:text-[var(--text)]">
            Gerenciar repasses →
          </Link>
        }
      >
        {report.rows.length === 0 ? (
          <Empty label="Nenhuma aula realizada no período" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Professor</Th>
                  <Th align="right">Valor/h</Th>
                  <Th align="right">Aulas</Th>
                  <Th align="right">Horas</Th>
                  <Th align="right">Alunos</Th>
                  <Th align="right">Custo</Th>
                  <Th align="right">Receita</Th>
                  <Th align="right">Resultado</Th>
                  <Th align="right">Margem</Th>
                  <Th align="right">Cancel.</Th>
                  <Th align="right">Nota</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.teacherId} className="border-t border-border">
                    <Td className="whitespace-nowrap font-medium">
                      {r.name}
                      {r.snapshot && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground" title="Custo veio do repasse já registrado">
                          ✓
                        </span>
                      )}
                    </Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(r.hourlyRate)}</Td>
                    <Td align="right" mono>{r.lessons}</Td>
                    <Td align="right" mono>{r.hours.toFixed(1).replace(".", ",")}</Td>
                    <Td align="right" mono className="text-muted-foreground">{r.students}</Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(r.cost)}</Td>
                    <Td align="right" mono>{brl(r.revenue)}</Td>
                    <Td align="right" mono
                      className={r.result >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {brl(r.result)}
                    </Td>
                    <Td align="right" mono>{r.revenue > 0 ? pct(r.marginPct, 0) : "–"}</Td>
                    <Td align="right" mono
                      className={cn(r.cancelPct > 20 && "text-[var(--danger)]", r.cancelPct === 0 && "text-muted-foreground")}>
                      {r.cancelled + r.missed > 0 ? pct(r.cancelPct, 0) : "–"}
                    </Td>
                    <Td align="right" mono className="text-muted-foreground">
                      {r.avgRating != null ? `${r.avgRating.toFixed(1).replace(".", ",")}★` : "–"}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-[var(--muted-soft)]">
                  <Td className="font-semibold">Total</Td>
                  <Td />
                  <Td align="right" mono className="font-semibold">
                    {report.rows.reduce((s, r) => s + r.lessons, 0)}
                  </Td>
                  <Td align="right" mono className="font-semibold">
                    {report.rows.reduce((s, r) => s + r.hours, 0).toFixed(1).replace(".", ",")}
                  </Td>
                  <Td />
                  <Td align="right" mono className="font-semibold">{brl(report.totalCost)}</Td>
                  <Td align="right" mono className="font-semibold">{brl(report.totalRevenue)}</Td>
                  <Td align="right" mono className="font-semibold">
                    {brl(report.totalRevenue - report.totalCost)}
                  </Td>
                  <Td /><Td /><Td />
                </tr>
              </tbody>
            </Table>
            <Note>
              A receita por professor é <strong>estimada</strong>: o banco não liga cobrança a
              aula. Vale para comparar professores entre si, não como faturamento real. O ✓
              marca quem já teve o repasse do mês registrado — nesses casos o custo é o valor
              histórico, não o recalculado pelo valor/hora atual.
            </Note>
          </>
        )}
      </Panel>

      {/* ── Execução ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Execução das aulas"
          subtitle={`${pct(stats.completionPct, 0)} concluídas · ${pct(stats.cancelPct, 0)} canceladas · ${pct(stats.missPct, 0)} faltas`}
        >
          {statusData.length === 0 ? (
            <Empty label="Nenhuma aula no período" />
          ) : (
            <>
              <DonutChart data={statusData} height={220} />
              <Table>
                <tbody>
                  <tr>
                    <Td>Avaliação média</Td>
                    <Td align="right" mono className="font-semibold">
                      {stats.avgRating != null
                        ? `${stats.avgRating.toFixed(1).replace(".", ",")}★`
                        : "sem avaliações"}
                    </Td>
                    <Td align="right" className="text-muted-foreground">
                      {num(stats.ratedCount)} avaliada{stats.ratedCount !== 1 ? "s" : ""}
                    </Td>
                  </tr>
                </tbody>
              </Table>
            </>
          )}
        </Panel>

        <Panel title="Composição das aulas realizadas" subtitle="Por modalidade e por tipo">
          {stats.completed === 0 ? (
            <Empty label="Nenhuma aula realizada no período" />
          ) : (
            <Table>
              <tbody>
                {stats.byModality.map((m) => (
                  <tr key={m.modality} className="border-t border-border first:border-0">
                    <Td className="w-[40%]">{MODALITY_LABEL[m.modality] ?? m.modality}</Td>
                    <Td><Bar ratio={m.count / stats.completed} color="#219EBC" /></Td>
                    <Td align="right" mono className="w-[60px]">{m.count}</Td>
                    <Td align="right" mono className="w-[56px] text-muted-foreground">
                      {pct((m.count / stats.completed) * 100, 0)}
                    </Td>
                  </tr>
                ))}
                {stats.byType.map((tp) => (
                  <tr key={tp.type} className="border-t border-border">
                    <Td>{LESSON_TYPE_LABEL[tp.type] ?? tp.type}</Td>
                    <Td><Bar ratio={tp.count / stats.completed} color="#8b5cf6" /></Td>
                    <Td align="right" mono>{tp.count}</Td>
                    <Td align="right" mono className="text-muted-foreground">
                      {pct((tp.count / stats.completed) * 100, 0)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      {/* ── Horários de pico ──────────────────────────────────────────────── */}
      <Panel
        title="Horários de pico"
        subtitle={
          peak.busiest
            ? `Mais cheio: ${DAY_LABEL[peak.busiest.day]} às ${String(peak.busiest.hour).padStart(2, "0")}h, ${peak.busiest.count} aulas no período`
            : "Aulas realizadas por dia da semana e hora (horário de Brasília)"
        }
      >
        {heatRows.length === 0 ? (
          <Empty label="Nenhuma aula realizada no período" />
        ) : (
          <>
            <Heatmap
              columns={peak.hours.map((h) => `${String(h).padStart(2, "0")}h`)}
              rows={heatRows}
              peak={peak.peak}
            />
            <Note>
              Serve para dimensionar equipe e sala: os horários escuros são onde falta
              professor disponível, e as faixas claras no meio da grade são capacidade
              ociosa que poderia virar aulão ou turma.
            </Note>
          </>
        )}
      </Panel>

      {/* ── Salas ─────────────────────────────────────────────────────────── */}
      {rooms.length > 0 && (
        <Panel title="Ocupação de salas" subtitle="Horas de aula realizadas em cada sala">
          <SimpleBarChart
            data={rooms.map((r) => ({ label: r.name, value: Math.round(r.hours) }))}
            color="#10b981"
            height={200}
            horizontal
          />
          <Table>
            <thead>
              <tr>
                <Th>Sala</Th>
                <Th>Tipo</Th>
                <Th align="right">Aulas</Th>
                <Th align="right">Horas</Th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-muted-foreground">
                    {r.type === "PHYSICAL" ? "Física" : "Virtual"}
                  </Td>
                  <Td align="right" mono>{r.lessons}</Td>
                  <Td align="right" mono>{r.hours.toFixed(1).replace(".", ",")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  )
}
