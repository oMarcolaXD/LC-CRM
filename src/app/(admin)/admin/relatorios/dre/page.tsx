import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type ReportSearchParams } from "@/lib/reports/period"
import { brl, brlRound, pct, num, margin } from "@/lib/reports/format"
import { getDRE, type DreMonth } from "@/lib/reports/dre"
import {
  getAttributedByTeacher, getAttributedBySubject,
  getAttributedByModality, getAttributedByType,
  MODALITY_LABEL, LESSON_TYPE_LABEL, type AttributedRow,
} from "@/lib/reports/attribution"
import { getTeacherCosts } from "@/lib/reports/costs"
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses"
import { Panel, StatGrid, Stat, Table, Th, Td, Empty, Note } from "../ui"
import { cn } from "@/lib/utils"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const [dre, byTeacher, bySubject, byModality, byType, costs] = await Promise.all([
    // periodMonths, não chartPoints: as colunas do quadro têm de ser os meses
    // do período, senão sobram colunas vazias e o total não fecha com elas.
    getDRE(b.start, b.end, b.periodMonths),
    getAttributedByTeacher(b.start, b.end),
    getAttributedBySubject(b.start, b.end),
    getAttributedByModality(b.start, b.end),
    getAttributedByType(b.start, b.end),
    getTeacherCosts(b.start, b.end),
  ])

  const t = dre.total
  const costOf = new Map(costs.byTeacher.map((c) => [c.teacherId, c]))

  // Margem por professor: receita atribuída às aulas dele menos o que custou.
  const teacherMargin = byTeacher
    .map((r) => {
      const c    = costOf.get(r.id)
      const cost = c?.cost ?? 0
      return {
        ...r,
        cost,
        result: r.revenue - cost,
        pct:    margin(r.revenue - cost, r.revenue),
      }
    })
    .sort((a, b2) => b2.result - a.result)

  const showMonths = dre.months.length > 1

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
        {" · "}receita pelo regime de caixa, despesas pelo mês de competência
      </p>

      <StatGrid cols={4}>
        <Stat label="Receita líquida" value={brlRound(t.netRevenue)}
          sub={`${brl(t.grossRevenue)} bruto − ${brl(t.fees)} de taxas`} />
        <Stat label="Margem de contribuição" value={brlRound(t.contribution)}
          sub={`${pct(t.contributionPct)} — sobra depois dos professores`}
          tone={t.contribution >= 0 ? "positive" : "negative"} />
        <Stat label="Despesas da empresa" value={brlRound(t.expenses)}
          sub={dre.months.length > 1 ? `média de ${brl(dre.monthlyExpenses)}/mês` : "no período"} />
        <Stat label="Resultado operacional" value={brlRound(t.profit)}
          sub={`${pct(t.profitPct)} de margem líquida`}
          tone={t.profit >= 0 ? "positive" : "negative"} />
      </StatGrid>

      {/* ── Quadro DRE ────────────────────────────────────────────────────── */}
      <Panel
        title="Demonstrativo de resultado"
        subtitle="Cada coluna é um mês; a última é o total do período"
      >
        {t.grossRevenue === 0 && t.expenses === 0 && t.teacherCost === 0 ? (
          <Empty label="Sem movimento financeiro no período" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="sticky left-0 bg-card">Linha</Th>
                  {showMonths && dre.months.map((m) => (
                    <Th key={m.key} align="right">{m.label}</Th>
                  ))}
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                <DreLine label="Receita bruta recebida" months={dre.months} pick={(m) => m.grossRevenue}
                  total={t.grossRevenue} showMonths={showMonths} />
                <DreLine label="(−) Taxas de cartão e boleto" months={dre.months} pick={(m) => -m.fees}
                  total={-t.fees} showMonths={showMonths} dim />
                <DreLine label="= Receita líquida" months={dre.months} pick={(m) => m.netRevenue}
                  total={t.netRevenue} showMonths={showMonths} strong />
                <DreLine label="(−) Custo com professores" months={dre.months} pick={(m) => -m.teacherCost}
                  total={-t.teacherCost} showMonths={showMonths} dim />
                <DreLine label="= Margem de contribuição" months={dre.months} pick={(m) => m.contribution}
                  total={t.contribution} showMonths={showMonths} strong signed />
                <DreLine label="Margem de contribuição %" months={dre.months}
                  pick={(m) => m.contributionPct} total={t.contributionPct}
                  showMonths={showMonths} format="pct" dim />

                {dre.expenseRows.length > 0 && (
                  <tr>
                    <Td className="sticky left-0 bg-card pt-3 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                      Despesas
                    </Td>
                    {showMonths && dre.months.map((m) => <Td key={m.key} />)}
                    <Td />
                  </tr>
                )}
                {dre.expenseRows.map((r) => (
                  <DreLine
                    key={r.category}
                    label={`(−) ${EXPENSE_CATEGORY_LABEL[r.category]}`}
                    months={dre.months}
                    pick={(m) => -(r.byMonth.get(m.key) ?? 0)}
                    total={-r.total}
                    showMonths={showMonths}
                    dim
                    indent
                  />
                ))}
                <DreLine label="(−) Total de despesas" months={dre.months} pick={(m) => -m.expenses}
                  total={-t.expenses} showMonths={showMonths} dim />

                <DreLine label="= Resultado operacional" months={dre.months} pick={(m) => m.profit}
                  total={t.profit} showMonths={showMonths} strong signed highlight />
                <DreLine label="Margem líquida %" months={dre.months} pick={(m) => m.profitPct}
                  total={t.profitPct} showMonths={showMonths} format="pct" signed />
              </tbody>
            </Table>

            <Note>
              Nada é contado duas vezes: taxa de maquininha vive só na cobrança
              (<code>feeAmount</code>), repasse de professor só no cálculo de repasses, e a
              tela de despesas não deve receber nenhum dos dois. Custo do professor usa o
              valor do repasse quando ele já foi registrado, e horas × valor/hora quando
              ainda não.
            </Note>
          </>
        )}
      </Panel>

      {/* ── Unidade econômica ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Economia por hora de aula"
          subtitle={`${num(dre.lessonCount)} aulas · ${num(Math.round(dre.lessonHours))} horas entregues no período`}
        >
          {dre.lessonHours === 0 ? (
            <Empty label="Nenhuma aula realizada no período" />
          ) : (
            <Table>
              <tbody>
                <UnitRow label="Receita líquida por hora" value={brl(t.netRevenue / dre.lessonHours)} />
                <UnitRow label="Custo de professor por hora" value={brl(t.teacherCost / dre.lessonHours)} />
                <UnitRow label="Margem de contribuição por hora" value={brl(dre.contributionPerHour)} strong />
                <UnitRow label="Despesa da empresa por hora" value={brl(t.expenses / dre.lessonHours)} />
                <UnitRow label="Lucro por hora" value={brl(t.profit / dre.lessonHours)} strong
                  tone={t.profit >= 0 ? "positive" : "negative"} />
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Ponto de equilíbrio"
          subtitle="Volume mensal que apenas cobre a estrutura"
        >
          {dre.breakEvenHours == null ? (
            <Empty
              label={
                dre.contributionPerHour <= 0
                  ? "Margem por hora zerada ou negativa"
                  : "Sem despesas lançadas no período"
              }
              hint={
                dre.contributionPerHour <= 0
                  ? "Sem margem por hora não existe ponto de equilíbrio: aumentar o volume aumenta o prejuízo."
                  : "Lance as despesas fixas para o sistema calcular quantas aulas por mês pagam a estrutura."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed">
                Com margem de{" "}
                <strong className="font-mono">{brl(dre.contributionPerHour)}</strong> por hora
                e despesa fixa de{" "}
                <strong className="font-mono">{brl(dre.monthlyExpenses)}</strong> por mês, a
                empresa precisa entregar{" "}
                <strong className="font-mono text-[var(--primary)]">
                  {Math.ceil(dre.breakEvenHours)} horas de aula por mês
                </strong>{" "}
                só para empatar.
              </p>
              <BreakEvenBar
                current={dre.lessonHours / Math.max(1, dre.months.length)}
                target={dre.breakEvenHours}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* ── Margem por professor ──────────────────────────────────────────── */}
      <Panel
        title="Margem por professor"
        subtitle="Receita atribuída às aulas de cada professor, menos o custo dele"
        action={
          <Link href="/admin/relatorios/professores" className="text-[11px] text-muted-foreground hover:text-[var(--text)]">
            Ver aba completa →
          </Link>
        }
      >
        {teacherMargin.length === 0 ? (
          <Empty label="Nenhuma aula realizada no período" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Professor</Th>
                  <Th align="right">Aulas</Th>
                  <Th align="right">Horas</Th>
                  <Th align="right">Receita atribuída</Th>
                  <Th align="right">Custo</Th>
                  <Th align="right">Resultado</Th>
                  <Th align="right">Margem</Th>
                </tr>
              </thead>
              <tbody>
                {teacherMargin.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <Td className="font-medium">{r.label}</Td>
                    <Td align="right" mono>{r.lessons}</Td>
                    <Td align="right" mono>{r.hours.toFixed(1).replace(".", ",")}</Td>
                    <Td align="right" mono>{brl(r.revenue)}</Td>
                    <Td align="right" mono className="text-muted-foreground">{brl(r.cost)}</Td>
                    <Td align="right" mono
                      className={r.result >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {brl(r.result)}
                    </Td>
                    <Td align="right" mono
                      className={r.pct >= 0 ? "" : "text-[var(--danger)]"}>
                      {r.revenue > 0 ? pct(r.pct, 0) : "–"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <AttributionNote />
          </>
        )}
      </Panel>

      {/* ── Recortes ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SliceTable title="Por matéria" rows={bySubject} />
        <SliceTable title="Por modalidade" rows={byModality} labelMap={MODALITY_LABEL} />
        <SliceTable title="Por tipo de aula" rows={byType} labelMap={LESSON_TYPE_LABEL} />
      </div>
    </div>
  )
}

// ─── Linha do DRE ─────────────────────────────────────────────────────────────

function DreLine({
  label, months, pick, total, showMonths, strong, dim, indent, highlight, signed, format = "brl",
}: {
  label:  string
  months: DreMonth[]
  pick:   (m: DreMonth) => number
  total:  number
  showMonths: boolean
  strong?:    boolean
  dim?:       boolean
  indent?:    boolean
  highlight?: boolean
  signed?:    boolean
  format?:    "brl" | "pct"
}) {
  const fmt = (v: number) => (format === "pct" ? pct(v, 1) : brl(v))
  const tone = (v: number) =>
    signed ? (v >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]") : ""

  return (
    <tr
      className={cn(
        "border-t border-border",
        highlight && "bg-[var(--muted-soft)]",
      )}
    >
      <Td
        className={cn(
          "sticky left-0 whitespace-nowrap bg-card",
          highlight && "bg-[var(--muted-soft)]",
          strong && "font-semibold",
          dim && "text-muted-foreground",
          indent && "pl-6",
        )}
      >
        {label}
      </Td>
      {showMonths && months.map((m) => {
        const v = pick(m)
        return (
          <Td key={m.key} align="right" mono
            className={cn(dim && "text-muted-foreground", strong && "font-semibold", tone(v))}>
            {fmt(v)}
          </Td>
        )
      })}
      <Td align="right" mono
        className={cn("font-semibold", dim && !strong && "font-normal text-muted-foreground", tone(total))}>
        {fmt(total)}
      </Td>
    </tr>
  )
}

function UnitRow({
  label, value, strong, tone,
}: {
  label: string; value: string; strong?: boolean; tone?: "positive" | "negative"
}) {
  return (
    <tr className="border-t border-border first:border-0">
      <Td className={cn(strong && "font-semibold")}>{label}</Td>
      <Td align="right" mono className={cn(
        strong && "font-semibold",
        tone === "positive" && "text-[var(--success)]",
        tone === "negative" && "text-[var(--danger)]",
      )}>
        {value}
      </Td>
    </tr>
  )
}

function BreakEvenBar({ current, target }: { current: number; target: number }) {
  const ratio  = target > 0 ? current / target : 0
  const passed = ratio >= 1
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[11.5px]">
        <span className="text-muted-foreground">
          Entregando hoje: <strong className="font-mono text-[var(--text)]">{current.toFixed(0)} h/mês</strong>
        </span>
        <span className={passed ? "text-[var(--success)]" : "text-[var(--warn)]"}>
          {passed
            ? `${((ratio - 1) * 100).toFixed(0)}% acima do equilíbrio`
            : `faltam ${Math.ceil(target - current)} h/mês`}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            background: passed ? "var(--success)" : "var(--warn)",
          }}
        />
      </div>
    </div>
  )
}

function SliceTable({
  title, rows, labelMap,
}: {
  title: string
  rows: AttributedRow[]
  labelMap?: Record<string, string>
}) {
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <Panel title={title} subtitle="Receita atribuída às aulas realizadas">
      {rows.length === 0 ? (
        <Empty label="Sem aulas no período" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th align="right">Aulas</Th>
              <Th align="right">Receita</Th>
              <Th align="right">%</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <Td className="font-medium">{labelMap?.[r.label] ?? r.label}</Td>
                <Td align="right" mono>{r.lessons}</Td>
                <Td align="right" mono>{brl(r.revenue)}</Td>
                <Td align="right" mono className="text-muted-foreground">
                  {total > 0 ? pct((r.revenue / total) * 100, 0) : "–"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  )
}

function AttributionNote() {
  return (
    <Note>
      <strong>Como a receita é atribuída:</strong> a cobrança não aponta para a aula no banco,
      então o valor é estimado — preço do aulão quando existe, senão o contrato da turma
      dividido pelas aulas dela, senão o preço/aula do pacote do aluno × duração. Serve para
      comparar professores, matérias e modalidades entre si; o total não fecha com a receita
      de caixa e não deveria.
    </Note>
  )
}
