import React           from "react"
import { auth }        from "@/lib/auth"
import { prisma }      from "@/lib/prisma"
import { Sparkline }   from "@/components/shared/kpi-card"
import { RevenueMetaChart } from "@/components/charts/revenue-meta-chart"
import { ModoBadge }   from "@/components/shared/modo-badge"
import { PeriodSelector } from "./period-selector"
import { CancellationActions } from "./cancellation-actions"
import { DashboardGreeting } from "@/components/shared/dashboard-greeting"
import Link            from "next/link"
import { cn }          from "@/lib/utils"
import {
  format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay,
  differenceInDays, startOfYear, endOfYear, subYears,
} from "date-fns"
import { ptBR } from "date-fns/locale"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}
function pct(v: number) {
  return `${Math.round(Math.min(v, 9.99) * 100)}%`
}

// ─── Período ──────────────────────────────────────────────────────────────────

type Periodo = "mes" | "mes-anterior" | "3meses" | "6meses" | "ano"

const VALID_PERIODOS: Periodo[] = ["mes", "mes-anterior", "3meses", "6meses", "ano"]

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "mes",          label: "Este mês"    },
  { id: "mes-anterior", label: "Mês anterior" },
  { id: "3meses",       label: "3 meses"     },
  { id: "6meses",       label: "6 meses"     },
  { id: "ano",          label: "Este ano"    },
]

type ChartPoint = { start: Date; end: Date; label: string }

function getPeriodBounds(periodo: Periodo, now: Date): {
  start:       Date
  end:         Date
  prevStart:   Date
  prevEnd:     Date
  periodLabel: string
  chartPoints: ChartPoint[]
  isMonthly:   boolean   // true → receitaGoal já é mensal
} {
  switch (periodo) {
    case "mes-anterior": {
      const ref = subMonths(now, 1)
      return {
        start:       startOfMonth(ref),
        end:         endOfMonth(ref),
        prevStart:   startOfMonth(subMonths(now, 2)),
        prevEnd:     endOfMonth(subMonths(now, 2)),
        periodLabel: format(ref, "MMMM · yyyy", { locale: ptBR }),
        chartPoints: Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(ref, 5 - i)
          return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
        }),
        isMonthly: true,
      }
    }
    case "3meses": {
      const s = startOfMonth(subMonths(now, 2))
      return {
        start:       s,
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 5)),
        prevEnd:     endOfMonth(subMonths(now, 3)),
        periodLabel: `${format(s, "MMM", { locale: ptBR })} – ${format(now, "MMM yyyy", { locale: ptBR })}`,
        chartPoints: Array.from({ length: 3 }, (_, i) => {
          const d = subMonths(now, 2 - i)
          return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
        }),
        isMonthly: false,
      }
    }
    case "6meses": {
      const s = startOfMonth(subMonths(now, 5))
      return {
        start:       s,
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 11)),
        prevEnd:     endOfMonth(subMonths(now, 6)),
        periodLabel: `${format(s, "MMM", { locale: ptBR })} – ${format(now, "MMM yyyy", { locale: ptBR })}`,
        chartPoints: Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(now, 5 - i)
          return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
        }),
        isMonthly: false,
      }
    }
    case "ano": {
      const monthsElapsed = now.getMonth() + 1
      return {
        start:       startOfYear(now),
        end:         endOfMonth(now),
        prevStart:   startOfYear(subYears(now, 1)),
        prevEnd:     endOfYear(subYears(now, 1)),
        periodLabel: format(now, "yyyy"),
        chartPoints: Array.from({ length: monthsElapsed }, (_, i) => {
          const d = new Date(now.getFullYear(), i, 1)
          return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
        }),
        isMonthly: false,
      }
    }
    default: { // "mes"
      return {
        start:       startOfMonth(now),
        end:         endOfMonth(now),
        prevStart:   startOfMonth(subMonths(now, 1)),
        prevEnd:     endOfMonth(subMonths(now, 1)),
        periodLabel: format(now, "MMMM · yyyy", { locale: ptBR }),
        chartPoints: Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(now, 5 - i)
          return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
        }),
        isMonthly: true,
      }
    }
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getOpsData(periodo: Periodo) {
  const now    = new Date()
  const bounds = getPeriodBounds(periodo, now)
  const { start, end, prevStart, prevEnd, periodLabel, chartPoints, isMonthly } = bounds

  const fetchFrom = chartPoints[0].start < prevStart ? chartPoints[0].start : prevStart

  const [
    paidPayments,
    overduePayments,
    allLessons,
    alunosAtivos,
    pendingCount,
    proximasAulas,
    lowPackages,
    pendingCancellations,
  ] = await Promise.all([
    prisma.payment.findMany({
      where:  { status: "PAID", paidAt: { gte: fetchFrom } },
      select: { amount: true, paidAt: true },
    }),
    prisma.payment.findMany({
      where:   { status: "OVERDUE" },
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
      take:    50,
    }),
    prisma.lesson.findMany({
      where:  { scheduledAt: { gte: fetchFrom } },
      select: { status: true, scheduledAt: true },
    }),
    prisma.student.count({
      where: { packages: { some: { status: "ACTIVE", remainingLessons: { gt: 0 } } } },
    }),
    prisma.lessonRequest.count({ where: { status: "PENDING" } }),
    prisma.lesson.findMany({
      where: {
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status:      { in: ["SCHEDULED", "CONFIRMED"] },
      },
      include: {
        participants: { take: 1, include: { student: { include: { user: true } } } },
        teacher:      { include: { user: true } },
        subject:      true,
      },
      orderBy: { scheduledAt: "asc" },
      take:    10,
    }),
    prisma.lessonPackage.count({
      where: { status: "ACTIVE", remainingLessons: { gt: 0, lte: 2 } },
    }),
    prisma.lessonCancellationRequest.findMany({
      where:   { status: "PENDING" },
      include: {
        lesson: {
          include: {
            subject:      true,
            teacher:      { include: { user: true } },
            participants: { take: 1, include: { student: true } },
          },
        },
        requestedBy: true,
      },
      orderBy: { createdAt: "asc" },
      take:    20,
    }),
  ])

  // ── Revenue ──────────────────────────────────────────────────────────────────
  const sumPaid = (s: Date, e: Date) =>
    paidPayments
      .filter((p) => p.paidAt! >= s && p.paidAt! <= e)
      .reduce((acc, p) => acc + Number(p.amount), 0)

  const receitaMes     = sumPaid(start, end)
  const receitaPrevMes = sumPaid(prevStart, prevEnd)
  const receitaSpark   = chartPoints.map((m) => sumPaid(m.start, m.end))
  const receitaDeltaNum = receitaPrevMes > 0
    ? Math.round(((receitaMes - receitaPrevMes) / receitaPrevMes) * 100)
    : null

  // ── Lessons ─────────────────────────────────────────────────────────────────
  const countLessons = (status: string, s: Date, e: Date) =>
    allLessons.filter((l) => l.status === status && l.scheduledAt >= s && l.scheduledAt <= e).length

  const aulasMes     = countLessons("COMPLETED", start, end)
  const aulasPrevMes = countLessons("COMPLETED", prevStart, prevEnd)
  const aulasSpark   = chartPoints.map((m) => countLessons("COMPLETED", m.start, m.end))
  const aulasDeltaNum = aulasPrevMes > 0
    ? Math.round(((aulasMes - aulasPrevMes) / aulasPrevMes) * 100)
    : null

  // ── Fetch stored goals for chart months ──────────────────────────────────────
  const monthsNeeded = chartPoints.map((m) => ({
    year:  m.start.getFullYear(),
    month: m.start.getMonth() + 1,
  }))
  const storedGoals = await prisma.monthlyGoal.findMany({
    where: {
      OR: monthsNeeded.map(({ year, month }) => ({ year, month })),
    },
  })
  const storedGoalMap = new Map(
    storedGoals.map((g) => [`${g.year}-${g.month}`, g])
  )

  // Per-chart-point meta (stored or auto-calc based on that month's prev revenue)
  const chartData = chartPoints.map((m) => {
    const key  = `${m.start.getFullYear()}-${m.start.getMonth() + 1}`
    const sg   = storedGoalMap.get(key)
    let meta: number
    if (sg?.revenueGoal != null) {
      meta = Number(sg.revenueGoal)
    } else {
      const prevS = new Date(m.start); prevS.setMonth(prevS.getMonth() - 1)
      const prevE = new Date(m.end);   prevE.setMonth(prevE.getMonth() - 1)
      const prev  = sumPaid(prevS, prevE)
      const cur   = sumPaid(m.start, m.end)
      meta = prev > 0 ? Math.round(prev * 1.1) : Math.max(Math.round(cur * 1.2), 1000)
    }
    return { m: m.label, v: sumPaid(m.start, m.end), meta }
  })

  // KPI goals — for the primary period month
  const primaryKey  = `${start.getFullYear()}-${start.getMonth() + 1}`
  const primaryGoal = storedGoalMap.get(primaryKey)

  const receitaGoal = primaryGoal?.revenueGoal != null
    ? Number(primaryGoal.revenueGoal)
    : receitaPrevMes > 0
      ? Math.round(receitaPrevMes * 1.1)
      : Math.max(Math.round(receitaMes * 1.2), 1000)

  const aulasGoal = primaryGoal?.lessonsGoal != null
    ? primaryGoal.lessonsGoal
    : aulasPrevMes > 0 ? Math.round(aulasPrevMes * 1.1) : Math.max(Math.round(aulasMes * 1.2), 10)

  const alunosGoal = primaryGoal?.studentsGoal ?? null

  // ── Students ─────────────────────────────────────────────────────────────────
  const alunosSpark = chartPoints.map((m) =>
    allLessons.filter(
      (l) => l.scheduledAt >= m.start && l.scheduledAt <= m.end && l.status !== "CANCELLED"
    ).length
  )

  // ── Overdue ─────────────────────────────────────────────────────────────────
  const inadimplenciaTotal  = overduePayments.reduce((s, p) => s + Number(p.amount), 0)
  const inadimplenciaAlunos = new Set(overduePayments.map((p) => p.studentId)).size
  const inadimplenciaSpark  = chartPoints.map((m) =>
    overduePayments
      .filter((p) => p.dueDate >= m.start && p.dueDate <= m.end)
      .reduce((s, p) => s + Number(p.amount), 0)
  )

  // ── Atrasados ────────────────────────────────────────────────────────────────
  const atrasados = overduePayments.map((p) => ({
    id:      p.id,
    aluno:   p.student.name ?? "Aluno",
    pacote:  p.description ?? "—",
    valor:   Number(p.amount),
    dias:    Math.max(0, differenceInDays(now, p.dueDate)),
    contato: p.student.user?.phone ?? p.student.user?.email ?? "—",
  }))

  // ── Alertas ─────────────────────────────────────────────────────────────────
  type AlertTipo = "danger" | "warn" | "info" | "success"
  const alertas: { tipo: AlertTipo; txt: string; acao?: string; href?: string }[] = []

  if (inadimplenciaAlunos > 0)
    alertas.push({
      tipo: "danger",
      txt:  `${inadimplenciaAlunos} aluno${inadimplenciaAlunos > 1 ? "s" : ""} com pagamento vencido — ${brl(inadimplenciaTotal)} em aberto`,
      acao: "Ver cobranças",
      href: "/admin/financeiro/pagamentos?filter=OVERDUE",
    })
  if (pendingCount > 0)
    alertas.push({
      tipo: "warn",
      txt:  `${pendingCount} pedido${pendingCount > 1 ? "s" : ""} de aula aguardando confirmação`,
      acao: "Ver agenda",
      href: "/admin/agenda",
    })
  if (pendingCancellations.length > 0)
    alertas.push({
      tipo: "warn",
      txt:  `${pendingCancellations.length} pedido${pendingCancellations.length > 1 ? "s" : ""} de cancelamento aguardando revisão`,
      acao: "Ver cancelamentos",
      href: "#cancelamentos",
    })
  if (lowPackages > 0)
    alertas.push({
      tipo: "warn",
      txt:  `${lowPackages} aluno${lowPackages > 1 ? "s" : ""} com saldo baixo (≤ 2 aulas restantes)`,
      acao: "Ver pacotes",
      href: "/admin/financeiro/pacotes",
    })
  if (alertas.length === 0)
    alertas.push({ tipo: "success", txt: "Tudo em ordem — nenhum alerta no momento" })

  // ── Próximas aulas ───────────────────────────────────────────────────────────
  const proximas = proximasAulas.map((l) => ({
    hora:       format(l.scheduledAt, "HH:mm"),
    aluno:      l.participants[0]?.student.name ?? "Aluno",
    materia:    l.subject?.name ?? "–",
    prof:       l.teacher.user.name.split(" ")[0],
    modo:       (l.modality === "PRESENCIAL" ? "sede" : "online") as "sede" | "online",
    confirmada: l.status === "CONFIRMED",
  }))

  const raw = periodLabel
  return {
    receitaMes, receitaGoal, receitaSpark, receitaDeltaNum,
    aulasMes, aulasGoal, aulasSpark, aulasDeltaNum,
    alunosAtivos, alunosGoal, alunosSpark,
    inadimplenciaTotal, inadimplenciaAlunos, inadimplenciaSpark,
    chartData, atrasados, alertas, proximas, pendingCancellations,
    periodLabel: raw.charAt(0).toUpperCase() + raw.slice(1),
    todayLabel:  format(now, "EEE, dd 'de' MMMM", { locale: ptBR }),
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OpsBtn({
  href, children, primary = false,
}: {
  href: string; children: React.ReactNode; primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-[6px] px-3 py-[6px] text-[12px] font-medium transition-opacity hover:opacity-80",
        primary
          ? "text-white"
          : "border border-border bg-card"
      )}
      style={primary ? { background: "var(--primary)", color: "#fff" } : { color: "var(--text)" }}
    >
      {children}
    </Link>
  )
}

function KpiCell({
  label, value, delta, deltaPos, sub, spark, sparkColor, goalProgress,
}: {
  label:         string
  value:         string
  delta:         string
  deltaPos:      boolean | null
  sub:           string
  spark:         number[]
  sparkColor:    string
  goalProgress?: number
}) {
  const dCls =
    deltaPos === null ? "bg-[var(--muted-soft)] text-muted-foreground"   :
    deltaPos          ? "bg-[var(--success-soft)] text-[var(--success)]" :
                        "bg-[var(--danger-soft)] text-[var(--danger)]"

  return (
    <div className="flex flex-col gap-1.5 bg-card p-[14px_16px_12px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          {label}
        </span>
        <span className={cn("inline-flex items-center rounded px-[5px] py-px font-mono text-[10px] font-semibold", dCls)}>
          {delta}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span
          className="font-mono text-[24px] font-semibold leading-none tracking-[-0.025em]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {value}
        </span>
        <Sparkline data={spark} color={sparkColor} width={92} height={26} />
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
      {goalProgress != null && (
        <div className="mt-0.5 h-[3px] overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div
            style={{ width: `${Math.min(100, goalProgress * 100).toFixed(1)}%`, height: "100%", background: sparkColor }}
          />
        </div>
      )}
    </div>
  )
}

const ALERT_COLORS = {
  danger:  { bg: "var(--danger-soft)",  border: "var(--danger)",  text: "var(--danger)"  },
  warn:    { bg: "var(--warn-soft)",    border: "var(--warn)",    text: "var(--warn)"    },
  info:    { bg: "var(--info-soft)",    border: "var(--info)",    text: "var(--info)"    },
  success: { bg: "var(--success-soft)", border: "var(--success)", text: "var(--success)" },
} as const

// ─── Page ─────────────────────────────────────────────────────────────────────


export default async function AdminOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo: rawPeriodo } = await searchParams
  const periodo = (VALID_PERIODOS.includes(rawPeriodo as Periodo) ? rawPeriodo : "mes") as Periodo

  const [d, session] = await Promise.all([getOpsData(periodo), auth()])
  const { receitaDeltaNum, aulasDeltaNum } = d

  const firstName = (session?.user?.name ?? "").split(" ")[0] || "Admin"

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <DashboardGreeting firstName={firstName} subtitle={`Operação · ${d.periodLabel}`} />
          </div>
          <div className="flex gap-1.5">
            <OpsBtn href="/admin/relatorios">↗ Relatórios</OpsBtn>
            <OpsBtn href="/admin/agenda" primary>+ Nova aula</OpsBtn>
          </div>
        </div>

        {/* Seletor de período */}
        <PeriodSelector current={periodo} />
      </div>

      {/* KPI row */}
      <div
        className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-border lg:grid-cols-4"
        style={{ gap: "1px", background: "var(--border)" }}
      >
        <KpiCell
          label="Receita do período"
          value={brl(d.receitaMes)}
          delta={receitaDeltaNum != null ? `${receitaDeltaNum >= 0 ? "+" : ""}${receitaDeltaNum}%` : "novo"}
          deltaPos={receitaDeltaNum != null ? receitaDeltaNum >= 0 : null}
          sub={`Meta ${brl(d.receitaGoal)} · ${pct(d.receitaGoal > 0 ? d.receitaMes / d.receitaGoal : 0)}`}
          spark={d.receitaSpark}
          sparkColor="var(--primary)"
          goalProgress={d.receitaGoal > 0 ? d.receitaMes / d.receitaGoal : 0}
        />
        <KpiCell
          label="Aulas realizadas"
          value={d.aulasMes.toLocaleString("pt-BR")}
          delta={aulasDeltaNum != null ? `${aulasDeltaNum >= 0 ? "+" : ""}${aulasDeltaNum}%` : "novo"}
          deltaPos={aulasDeltaNum != null ? aulasDeltaNum >= 0 : null}
          sub={`Meta ${d.aulasGoal} · ${pct(d.aulasGoal > 0 ? d.aulasMes / d.aulasGoal : 0)}`}
          spark={d.aulasSpark}
          sparkColor="var(--info)"
        />
        <KpiCell
          label="Alunos ativos"
          value={String(d.alunosAtivos)}
          delta="ativos"
          deltaPos={null}
          sub={
            d.alunosGoal != null
              ? `Meta ${d.alunosGoal} · ${pct(d.alunosGoal > 0 ? d.alunosAtivos / d.alunosGoal : 0)}`
              : `${d.inadimplenciaAlunos} inadimplente${d.inadimplenciaAlunos !== 1 ? "s" : ""}`
          }
          spark={d.alunosSpark}
          sparkColor="var(--success)"
          goalProgress={d.alunosGoal != null && d.alunosGoal > 0 ? d.alunosAtivos / d.alunosGoal : undefined}
        />
        <KpiCell
          label="Inadimplência"
          value={brl(d.inadimplenciaTotal)}
          delta={`${d.inadimplenciaAlunos} aluno${d.inadimplenciaAlunos !== 1 ? "s" : ""}`}
          deltaPos={d.inadimplenciaTotal > 0 ? false : null}
          sub={`Ticket méd. ${brl(d.inadimplenciaAlunos > 0 ? d.inadimplenciaTotal / d.inadimplenciaAlunos : 0)}`}
          spark={d.inadimplenciaSpark}
          sparkColor="var(--danger)"
        />
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">

        {/* Left column */}
        <div className="flex min-h-0 flex-col gap-4">

          {/* Revenue chart */}
          <div className="overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
              <div>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">Receita vs. meta</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.periodLabel} · linha pontilhada = meta por período
                </p>
              </div>
              <div className="mt-0.5 flex items-center gap-3.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-[2px] w-3.5 rounded" style={{ background: "var(--primary)" }} />
                  Receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3.5"
                    style={{ borderTop: "1.5px dashed var(--subtle)", height: 0 }}
                  />
                  Meta
                </span>
              </div>
            </div>
            <div className="px-3 pb-3">
              <RevenueMetaChart data={d.chartData} />
            </div>
          </div>

          {/* Atrasados table */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
              <div>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">Pagamentos atrasados</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.atrasados.length} aluno{d.atrasados.length !== 1 ? "s" : ""} · {brl(d.inadimplenciaTotal)} em aberto
                </p>
              </div>
              <Link
                href="/admin/financeiro/pagamentos?filter=OVERDUE"
                className="shrink-0 rounded-[6px] border border-border bg-card px-3 py-[5px] text-[12px] font-medium transition-colors hover:bg-[var(--hover)]"
                style={{ color: "var(--text)" }}
              >
                Ver todos
              </Link>
            </div>

            {d.atrasados.length === 0 ? (
              <p className="px-4 pb-5 text-center text-[12.5px] text-muted-foreground">
                Nenhum pagamento atrasado ✓
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                      <th className="border-b border-border px-[14px] py-[8px] font-medium">Aluno</th>
                      <th className="border-b border-border px-[14px] py-[8px] font-medium">Descrição</th>
                      <th className="border-b border-border px-[14px] py-[8px] text-right font-medium">Valor</th>
                      <th className="border-b border-border px-[14px] py-[8px] text-right font-medium">Atraso</th>
                      <th className="border-b border-border px-[14px] py-[8px] font-medium">Contato</th>
                      <th className="border-b border-border px-[14px] py-[8px] text-right font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.atrasados.map((r) => {
                      const diasStyle =
                        r.dias >= 15
                          ? { background: "var(--danger-soft)", color: "var(--danger)" }
                          : r.dias >= 7
                          ? { background: "var(--warn-soft)",   color: "var(--warn)"   }
                          : { background: "var(--hover)",       color: "var(--subtle)"  }
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-[14px] py-[9px] font-medium">{r.aluno}</td>
                          <td className="px-[14px] py-[9px] text-muted-foreground">{r.pacote}</td>
                          <td
                            className="px-[14px] py-[9px] text-right font-mono"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {brl(r.valor)}
                          </td>
                          <td className="px-[14px] py-[9px] text-right">
                            <span
                              className="inline-flex items-center rounded px-[7px] py-[2px] font-mono text-[11px] font-semibold"
                              style={diasStyle}
                            >
                              {r.dias}d
                            </span>
                          </td>
                          <td className="px-[14px] py-[9px] text-muted-foreground">{r.contato}</td>
                          <td className="px-[14px] py-[9px] text-right">
                            <Link
                              href="/admin/financeiro/pagamentos?filter=OVERDUE"
                              className="text-[11px] font-medium transition-opacity hover:opacity-70"
                              style={{ color: "var(--primary)" }}
                            >
                              Cobrar →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex min-h-0 flex-col gap-4">

          {/* Alertas */}
          <div className="overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="p-[12px_14px_8px]">
              <p className="text-[13px] font-semibold tracking-[-0.01em]">Precisa de atenção</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.alertas.filter((a) => a.tipo !== "success").length > 0
                  ? `${d.alertas.filter((a) => a.tipo !== "success").length} ite${d.alertas.filter((a) => a.tipo !== "success").length > 1 ? "ns" : "m"}`
                  : "tudo em ordem"}
              </p>
            </div>
            <div className="flex flex-col gap-[3px] px-[14px] pb-[14px]">
              {d.alertas.map((a, i) => {
                const c = ALERT_COLORS[a.tipo]
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-[6px] px-3 py-[10px]"
                    style={{ background: c.bg, borderLeft: `2px solid ${c.border}` }}
                  >
                    <span
                      className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: c.border }}
                    />
                    <span className="flex-1 text-[12.5px] leading-[1.35]" style={{ color: "var(--text)" }}>
                      {a.txt}
                    </span>
                    {a.acao && a.href && (
                      <Link
                        href={a.href}
                        className="shrink-0 whitespace-nowrap text-[11px] font-medium transition-opacity hover:opacity-70"
                        style={{ color: c.text }}
                      >
                        {a.acao} →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cancelamentos pendentes */}
          {d.pendingCancellations.length > 0 && (
            <div id="cancelamentos" className="overflow-hidden rounded-[10px] border border-amber-200 bg-card">
              <div className="p-[12px_14px_8px]">
                <p className="text-[13px] font-semibold tracking-[-0.01em]">Cancelamentos pendentes</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.pendingCancellations.length} pedido{d.pendingCancellations.length !== 1 ? "s" : ""} aguardando revisão
                </p>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {d.pendingCancellations.map(cr => (
                  <div key={cr.id} className="px-3.5 py-2.5 flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">🚫</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate">
                        {cr.lesson.subject?.name ?? "–"} · {cr.lesson.teacher.user.name.split(" ")[0]}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(cr.lesson.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                        {" · "}{cr.lesson.participants[0]?.student.name ?? "–"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Solicitado por {cr.requestedBy.name.split(" ")[0]}
                        {cr.reason && <span className="italic"> · "{cr.reason}"</span>}
                      </p>
                    </div>
                    <CancellationActions requestId={cr.id} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximas aulas */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
              <div>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">Próximas aulas</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Hoje · {d.todayLabel}</p>
              </div>
              <Link
                href="/admin/agenda"
                className="text-[11px] text-muted-foreground transition-colors hover:text-[var(--text)]"
              >
                Ver agenda →
              </Link>
            </div>

            <div className="flex-1 overflow-auto pb-2">
              {d.proximas.length === 0 ? (
                <p className="px-4 pb-5 text-center text-[12.5px] text-muted-foreground">
                  Nenhuma aula agendada para hoje
                </p>
              ) : (
                d.proximas.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[6px] px-4 py-[9px]">
                    <span
                      className="w-[42px] shrink-0 font-mono text-[12px] font-semibold"
                      style={{ color: "var(--text)", fontFeatureSettings: '"tnum"' }}
                    >
                      {a.hora}
                    </span>
                    <div className="min-w-0 flex-1 leading-[1.3]">
                      <p className="truncate text-[12.5px] font-medium">{a.aluno}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {a.materia} · {a.prof}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ModoBadge modo={a.modo} size="sm" />
                      <span
                        className="inline-flex items-center rounded px-[6px] py-[2px] font-mono text-[10px]"
                        style={{
                          background: a.confirmada ? "var(--success-soft)" : "var(--warn-soft)",
                          color:      a.confirmada ? "var(--success)"      : "var(--warn)",
                        }}
                      >
                        {a.confirmada ? "✓" : "?"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
