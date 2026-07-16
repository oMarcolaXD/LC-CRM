import React     from "react"
import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link       from "next/link"
import { PedidoRow }       from "./pedido-row"
import { DashboardClock }  from "@/components/colaborador/dashboard-clock"
import {
  format, startOfDay, endOfDay, getDay,
  differenceInHours, differenceInDays,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { toBrazilDate, nowBrazil } from "@/lib/datetime"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getColabData(userId?: string) {
  const now = nowBrazil()
  const dow = getDay(now)

  const [
    pendingRequests,
    todayLessons,
    overduePayments,
    teachers,
    unreadCount,
  ] = await Promise.all([
    prisma.lessonRequest.findMany({
      where:   { status: "PENDING" },
      include: {
        student: { include: { user: true, guardian: { include: { user: true } } } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.lesson.findMany({
      where:  { scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      select: { teacherId: true, scheduledAt: true, status: true },
    }),
    prisma.payment.findMany({
      where:   { status: "OVERDUE" },
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
      take:    10,
    }),
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    userId
      ? prisma.notification.count({ where: { userId, read: false } })
      : Promise.resolve(0),
  ])

  // ── KPI computations ─────────────────────────────────────────────────────────
  const confirmadasHoje = todayLessons.filter(
    (l) => ["SCHEDULED", "CONFIRMED"].includes(l.status)
  ).length
  const pendingOldCount = pendingRequests.filter(
    (r) => differenceInHours(now, r.requestedAt) > 12
  ).length
  const overdueUrgent = overduePayments.filter(
    (p) => differenceInDays(now, p.dueDate) >= 15
  ).length

  // ── Disponibilidade grid (8h–20h) ────────────────────────────────────────────
  const HOURS = Array.from({ length: 13 }, (_, i) => i + 8)

  function isAvailableAt(availability: unknown, hour: number): boolean {
    if (!availability || typeof availability !== "object") return false
    const avail = availability as Record<string, { start: string; end: string }[]>
    const slots = avail[String(dow)] ?? []
    return slots.some((s) => {
      const sh = parseInt(s.start.split(":")[0])
      const eh = parseInt(s.end.split(":")[0])
      return sh <= hour && hour < eh
    })
  }

  const todayRequests = pendingRequests.filter(
    (r) => r.preferredAt >= startOfDay(now) && r.preferredAt <= endOfDay(now)
  )

  // Prioridade: professores já no Lição (têm aula hoje) com dia mais compacto primeiro.
  // Dia compacto = menor span entre primeira e última aula → professor não fica esperando/sai tarde.
  // Depois: quem tem disponibilidade mas sem aulas. Por último: sem agenda hoje.
  function teacherPriority(t: typeof teachers[0]): { tier: number; span: number } {
    const lessonHours = todayLessons
      .filter((l) => l.teacherId === t.id && ["SCHEDULED", "CONFIRMED"].includes(l.status))
      .map((l) => toBrazilDate(l.scheduledAt).getHours())
      .sort((a, b) => a - b)

    if (lessonHours.length > 0) {
      const span = lessonHours[lessonHours.length - 1] - lessonHours[0]
      return { tier: 2, span }
    }
    if (HOURS.some((h) => isAvailableAt(t.availability, h))) {
      return { tier: 1, span: 0 }
    }
    return { tier: 0, span: 0 }
  }

  const GRID_LIMIT = 6
  const sortedTeachers = [...teachers].sort((a, b) => {
    const pa = teacherPriority(a)
    const pb = teacherPriority(b)
    if (pb.tier !== pa.tier) return pb.tier - pa.tier
    // Mesmo tier: span menor aparece primeiro (dia mais compacto)
    return pa.span - pb.span
  })
  const gridTeachers   = sortedTeachers.slice(0, GRID_LIMIT)
  const hiddenTeachers = Math.max(0, teachers.length - GRID_LIMIT)

  type CellStatus = "busy" | "request" | "free" | "none"
  function cellStatus(teacherId: string, hour: number): CellStatus {
    if (
      todayLessons.some(
        (l) =>
          l.teacherId === teacherId &&
          toBrazilDate(l.scheduledAt).getHours() === hour &&
          ["SCHEDULED", "CONFIRMED"].includes(l.status)
      )
    )
      return "busy"
    if (
      todayRequests.some(
        (r) => r.teacherId === teacherId && toBrazilDate(r.preferredAt).getHours() === hour
      )
    )
      return "request"
    const teacher = teachers.find((t) => t.id === teacherId)
    if (teacher && isAvailableAt(teacher.availability, hour)) return "free"
    return "none"
  }

  const gridMatrix = gridTeachers.map((t) => ({
    id:       t.id,
    name:     t.user.name,
    initials: t.user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase(),
    cells: HOURS.map((h) => ({ hour: h, status: cellStatus(t.id, h) })),
  }))

  // Find a quick encaixe suggestion
  let encaixe: string | null = null
  for (const t of gridMatrix) {
    const freeCells = t.cells.filter((c) => c.status === "free").map((c) => c.hour)
    if (freeCells.length >= 2) {
      const firstName = t.name.split(" ")[0]
      const hoursStr  = freeCells.slice(0, 2).map((h) => `${h}h`).join(" e ")
      encaixe = `${firstName} tem janela livre às ${hoursStr} — encaixe possível para pedidos de hoje.`
      break
    }
  }

  // ── Tarefas derivadas (sem model de Task no schema) ──────────────────────────
  const tasks: { txt: string; tag: string; color: string; done: boolean }[] = []

  for (const r of pendingRequests.slice(0, 3)) {
    const h         = differenceInHours(now, r.requestedAt)
    const firstName = (r.student.name ?? "Aluno").split(" ")[0]
    tasks.push({
      txt:   `Responder pedido de ${firstName} — ${r.subject?.name ?? "matéria"} (há ${h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`})`,
      tag:   "agendamento",
      color: h > 12 ? "danger" : "accent",
      done:  false,
    })
  }
  for (const p of overduePayments.slice(0, 2)) {
    const dias      = differenceInDays(now, p.dueDate)
    const firstName = (p.student.name ?? "Aluno").split(" ")[0]
    tasks.push({
      txt:   `Cobrar ${firstName} — ${dias}d em atraso`,
      tag:   "cobrança",
      color: dias >= 15 ? "danger" : "muted",
      done:  false,
    })
  }

  // ── Format pending requests for PedidoRow ────────────────────────────────────
  const formattedRequests = pendingRequests.slice(0, 8).map((r) => {
    const ha           = differenceInHours(now, r.requestedAt)
    const studentName  = r.student.name ?? "Aluno"
    const guardianName = r.student.guardian?.user.name
    return {
      id:          r.id,
      studentName,
      respName:    guardianName ?? studentName,
      teacherName: r.teacher.user.name,
      teacherMode: r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
      subjectName: r.subject?.name ?? "–",
      preferredAt: r.preferredAt.toISOString(),
      modality:    r.modality as "PRESENCIAL" | "ONLINE",
      notes:       r.reason ?? null,
      horasAtras:  ha,
      tag:         (ha > 12 ? "antigo" : ha < 2 ? "novo" : "pendente") as
                   "novo" | "antigo" | "pendente",
    }
  })

  // ── Cobranças individuais (SEM totalizador) ───────────────────────────────────
  const cobrancas = overduePayments.map((p) => ({
    id:      p.id,
    aluno:   p.student.name ?? "Aluno",
    pacote:  p.description ?? "—",
    valor:   Number(p.amount),
    dias:    Math.max(0, differenceInDays(now, p.dueDate)),
    contato: p.student.user?.phone ?? p.student.user?.email ?? "—",
  }))

  const hora     = now.getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"
  const raw      = format(now, "EEEE · dd 'de' MMMM", { locale: ptBR })

  return {
    saudacao,
    dateLabel:     raw.charAt(0).toUpperCase() + raw.slice(1),
    totalPendentes: pendingRequests.length + overdueUrgent,
    pendingCount:   pendingRequests.length,
    pendingOldCount,
    confirmadasHoje,
    overdueCount:   overduePayments.length,
    overdueUrgent,
    unreadCount,
    formattedRequests,
    gridTeachers:   gridMatrix,
    hiddenTeachers,
    totalTeachers:  teachers.length,
    hours:          HOURS,
    encaixe,
    cobrancas,
    tasks,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColabKpiCell({
  label, value, sub, tag, tagColor, icon,
}: {
  label:    string
  value:    string | number
  sub:      string
  tag:      string
  tagColor: "danger" | "success" | "accent" | "info" | "warn" | "muted"
  icon:     string
}) {
  const C: Record<string, { bg: string; color: string }> = {
    danger:  { bg: "var(--danger-soft)",  color: "var(--danger)"  },
    success: { bg: "var(--success-soft)", color: "var(--success)" },
    accent:  { bg: "var(--accent-soft)",  color: "var(--primary)" },
    info:    { bg: "var(--info-soft)",    color: "var(--info)"    },
    warn:    { bg: "var(--warn-soft)",    color: "var(--warn)"    },
    muted:   { bg: "var(--muted-soft)",   color: "var(--subtle)"   },
  }
  const c = C[tagColor]
  return (
    <div className="flex flex-col gap-1 bg-card p-[14px_16px]">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {label}
        </span>
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[12px]"
          style={{ background: c.bg, color: c.color }}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {value}
        </span>
        <span
          className="rounded-[3px] px-[6px] py-[2px] font-mono text-[10.5px]"
          style={{ background: c.bg, color: c.color }}
        >
          {tag}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

const CELL: Record<string, { bg: string; color: string; sym: string }> = {
  busy:    { bg: "var(--danger-soft)",  color: "var(--danger)",  sym: "■" },
  request: { bg: "var(--accent-soft)",  color: "var(--primary)", sym: "?" },
  free:    { bg: "var(--success-soft)", color: "var(--success)", sym: "·" },
  none:    { bg: "transparent",         color: "var(--subtle)",   sym: ""  },
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  accent:  { bg: "var(--accent-soft)",  color: "var(--primary)" },
  danger:  { bg: "var(--danger-soft)",  color: "var(--danger)"  },
  info:    { bg: "var(--info-soft)",    color: "var(--info)"    },
  success: { bg: "var(--success-soft)", color: "var(--success)" },
  muted:   { bg: "var(--muted-soft)",   color: "var(--subtle)"   },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ColaboradorDashboard() {
  const session = await auth()
  const userId  = (session?.user as { id?: string })?.id
  const d       = await getColabData(userId)

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header */}
      <DashboardClock
        firstName={session?.user?.name?.split(" ")[0] ?? ""}
        totalPendentes={d.totalPendentes}
      />

      {/* 4 KPIs */}
      <div
        className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-border lg:grid-cols-4"
        style={{ gap: "1px", background: "var(--border)" }}
      >
        <ColabKpiCell
          label="Pedidos pendentes"
          value={d.pendingCount}
          sub={d.pendingOldCount > 0 ? `${d.pendingOldCount} há +12h · responder` : "aguardando confirmação"}
          tag={d.pendingOldCount > 0 ? "urgente" : "pendentes"}
          tagColor={d.pendingOldCount > 0 ? "danger" : "accent"}
          icon="◷"
        />
        <ColabKpiCell
          label="Aulas confirmadas"
          value={d.confirmadasHoje}
          sub="agendadas para hoje"
          tag="hoje"
          tagColor="success"
          icon="✓"
        />
        <ColabKpiCell
          label="Cobranças em aberto"
          value={d.overdueCount}
          sub={d.overdueUrgent > 0 ? `${d.overdueUrgent} com +15 dias` : "sem atrasos críticos"}
          tag={d.overdueUrgent > 0 ? `${d.overdueUrgent} críticas` : "em aberto"}
          tagColor={d.overdueUrgent > 0 ? "danger" : "warn"}
          icon="§"
        />
        <ColabKpiCell
          label="Notificações"
          value={d.unreadCount}
          sub="não lidas"
          tag={d.unreadCount > 0 ? "novas" : "tudo lido"}
          tagColor={d.unreadCount > 0 ? "info" : "muted"}
          icon="✉"
        />
      </div>

      {/* Main: Pedidos + Disponibilidade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">

        {/* Fila de pedidos */}
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em]">
                Fila de pedidos · agendamento
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.pendingCount} pedido{d.pendingCount !== 1 ? "s" : ""} aguardando · por tempo de espera
              </p>
            </div>
            <Link
              href="/colaborador/agendamentos"
              className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-[var(--text)]"
            >
              Ver todos →
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {d.formattedRequests.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                Nenhuma solicitação pendente ✓
              </p>
            ) : (
              d.formattedRequests.map((r) => (
                <PedidoRow key={r.id} {...r} />
              ))
            )}
          </div>
        </div>

        {/* Disponibilidade dos professores */}
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-2 p-[12px_14px_8px]">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em]">Disponibilidade hoje</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.hiddenTeachers > 0
                  ? `Top ${Math.min(d.totalTeachers, 6)} por relevância · ${d.hiddenTeachers} professor${d.hiddenTeachers !== 1 ? "es" : ""} oculto${d.hiddenTeachers !== 1 ? "s" : ""}`
                  : "Use para confirmar pedidos com encaixe rápido"}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              {d.hiddenTeachers > 0 && (
                <Link
                  href="/colaborador/agenda"
                  className="shrink-0 font-medium transition-opacity hover:opacity-70"
                  style={{ color: "var(--primary)" }}
                >
                  Ver todos ({d.totalTeachers}) →
                </Link>
              )}
              {(["free", "busy", "request"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-[10px] w-[10px] rounded-[2px]"
                    style={{ background: CELL[s].color }}
                  />
                  {s === "free" ? "livre" : s === "busy" ? "ocupado" : "pedido"}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto px-[18px] pb-[14px]">
            {d.gridTeachers.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-muted-foreground">
                Nenhum professor ativo
              </p>
            ) : (
              <>
                <div
                  style={{
                    display:               "grid",
                    gridTemplateColumns:   `88px repeat(${d.hours.length}, 1fr)`,
                    gap:                   4,
                    fontSize:              11,
                    minWidth:              88 + d.hours.length * 34,
                  }}
                >
                  {/* Hour headers */}
                  <div />
                  {d.hours.map((h) => (
                    <div
                      key={h}
                      className="text-center font-mono text-[10px]"
                      style={{ color: "var(--subtle)" }}
                    >
                      {String(h).padStart(2, "0")}h
                    </div>
                  ))}

                  {/* Teacher rows */}
                  {d.gridTeachers.map((t) => (
                    <React.Fragment key={t.id}>
                      <div className="flex items-center gap-1.5 py-[5px]">
                        <div
                          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border text-[9px] font-semibold"
                          style={{ background: "var(--card-2)", color: "var(--text-2)" }}
                        >
                          {t.initials}
                        </div>
                        <span
                          className="truncate text-[11px] font-medium"
                          style={{ maxWidth: 54, color: "var(--text)" }}
                        >
                          {t.name.split(" ")[0]}
                        </span>
                      </div>
                      {t.cells.map((c) => {
                        const cs = CELL[c.status]
                        return (
                          <div
                            key={c.hour}
                            className="flex h-[28px] items-center justify-center rounded-[4px] font-mono text-[10px]"
                            style={{ background: cs.bg, color: cs.color }}
                          >
                            {cs.sym}
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>

                {d.encaixe && (
                  <div
                    className="mt-3 flex items-center gap-2 rounded-[7px] px-[10px] py-[9px] text-[11.5px]"
                    style={{ background: "var(--info-soft)", color: "var(--text-2)" }}
                  >
                    <span style={{ color: "var(--info)" }}>ℹ</span>
                    <span>{d.encaixe}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Cobranças + Tarefas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">

        {/* Cobranças do dia — SEM totalizador da empresa */}
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em]">Cobranças do dia</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.cobrancas.length} aluno{d.cobrancas.length !== 1 ? "s" : ""} para contatar · priorize maiores atrasos
              </p>
            </div>
            <Link
              href="/colaborador/financeiro"
              className="shrink-0 rounded-[6px] border border-border bg-card px-3 py-[5px] text-[12px] font-medium transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--text)" }}
            >
              Ver todas
            </Link>
          </div>

          {d.cobrancas.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              Nenhuma cobrança pendente ✓
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                    <th className="border-b border-border px-[14px] py-[8px] font-medium">Aluno</th>
                    <th className="border-b border-border px-[14px] py-[8px] font-medium">Descrição</th>
                    <th className="border-b border-border px-[14px] py-[8px] text-right font-medium">Valor</th>
                    <th className="border-b border-border px-[14px] py-[8px] text-center font-medium">Atraso</th>
                    <th className="border-b border-border px-[14px] py-[8px] font-medium">Canal</th>
                    <th className="border-b border-border px-[14px] py-[8px] text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cobrancas.map((r) => {
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
                        <td className="px-[14px] py-[9px] text-center">
                          <span
                            className="inline-flex items-center rounded px-[7px] py-[2px] font-mono text-[11px] font-semibold"
                            style={diasStyle}
                          >
                            {r.dias}d
                          </span>
                        </td>
                        <td className="px-[14px] py-[9px] text-muted-foreground truncate max-w-[120px]">
                          {r.contato}
                        </td>
                        <td className="px-[14px] py-[9px] text-right">
                          <Link
                            href="/colaborador/financeiro"
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

        {/* Minhas tarefas (derivadas de dados reais) */}
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em]">Minhas tarefas</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.tasks.filter((t) => !t.done).length} pendente{d.tasks.filter((t) => !t.done).length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/colaborador/agendamentos"
              className="text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--primary)" }}
            >
              Ver agendamentos →
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-border px-[14px] pb-3">
            {d.tasks.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                Nenhuma tarefa pendente ✓
              </p>
            ) : (
              d.tasks.map((t, i) => {
                const tc = TAG_COLORS[t.color] ?? TAG_COLORS.muted
                return (
                  <div key={i} className="flex items-start gap-2.5 py-[7px]">
                    <div
                      className="mt-[2px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
                      style={{
                        border:     `1.5px solid ${t.done ? "var(--success)" : "var(--border-strong)"}`,
                        background: t.done ? "var(--success)" : "transparent",
                      }}
                    >
                      {t.done ? "✓" : ""}
                    </div>
                    <span
                      className="flex-1 text-[12px] leading-snug"
                      style={{
                        color:          t.done ? "var(--subtle)" : "var(--text)",
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.txt}
                    </span>
                    <span
                      className="shrink-0 rounded-[3px] px-[6px] py-[1px] font-mono text-[10px]"
                      style={{ background: tc.bg, color: tc.color }}
                    >
                      {t.tag}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
