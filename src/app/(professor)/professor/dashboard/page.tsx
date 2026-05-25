import React     from "react"
import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect }  from "next/navigation"
import Link       from "next/link"
import { MeusAlunos } from "./meus-alunos"
import { ModoBadge }  from "@/components/shared/modo-badge"
import { DashboardGreeting } from "@/components/shared/dashboard-greeting"
import {
  format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay,
  differenceInHours, differenceInDays, differenceInMinutes,
} from "date-fns"
import { ptBR } from "date-fns/locale"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}
function relDate(date: Date, now: Date): string {
  const h = differenceInHours(now, date)
  const d = differenceInDays(now, date)
  if (h < 2)  return `hoje ${format(date, "HH")}h`
  if (h < 24) return `há ${h}h`
  if (d === 1) return "ontem"
  return `há ${d} dias`
}
function relAgo(date: Date, now: Date): string {
  const h = differenceInHours(now, date)
  const d = differenceInDays(now, date)
  if (h < 1)  return "há pouco"
  if (h < 24) return `há ${h}h`
  if (d === 1) return "ontem"
  return `há ${d} dias`
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getProfData(email: string) {
  const now = new Date()

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
  })
  const thisStart = startOfMonth(now)
  const thisEnd   = endOfMonth(now)
  const prevStart = startOfMonth(subMonths(now, 1))
  const prevEnd   = endOfMonth(subMonths(now, 1))

  const teacher = await prisma.teacher.findFirst({
    where:   { user: { email } },
    include: { user: true, subjects: { include: { subject: true } } },
  })
  if (!teacher) return null

  const rate = Number(teacher.hourlyRate)

  const [todayLessons, allLessons] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        teacherId:   teacher.id,
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: {
        participants: {
          take:    1,
          include: { student: { include: { user: true } } },
        },
        subject: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.lesson.findMany({
      where:   { teacherId: teacher.id, scheduledAt: { gte: months[0].start } },
      include: {
        participants: {
          take:    1,
          include: {
            student: {
              include: {
                user:     true,
                packages: { where: { status: "ACTIVE" }, take: 1, orderBy: { purchaseDate: "desc" } },
              },
            },
          },
        },
        subject:   true,
        homework: true,
      },
      orderBy: { scheduledAt: "desc" },
    }),
  ])

  // ── MiniStats ─────────────────────────────────────────────────────────────────
  const aulasHoje    = todayLessons.filter(l => ["SCHEDULED","CONFIRMED","COMPLETED"].includes(l.status)).length
  const aulasMes     = allLessons.filter(l => l.status === "COMPLETED" && l.scheduledAt >= thisStart && l.scheduledAt <= thisEnd).length
  const aulasPrevMes = allLessons.filter(l => l.status === "COMPLETED" && l.scheduledAt >= prevStart && l.scheduledAt <= prevEnd).length
  const ganhosMes    = aulasMes * rate
  const deltaAulas   = aulasPrevMes > 0 ? Math.round(((aulasMes - aulasPrevMes) / aulasPrevMes) * 100) : null

  const ratedLessons = allLessons.filter(l => l.studentRating != null)
  const avgRating    = ratedLessons.length > 0
    ? (ratedLessons.reduce((s, l) => s + (l.studentRating ?? 0), 0) / ratedLessons.length).toFixed(1)
    : "–"

  // ── Timeline (8h–22h) ─────────────────────────────────────────────────────────
  const SH = 8, EH = 22, SPAN = EH - SH

  const nextLesson = todayLessons.find(
    l => l.scheduledAt > now && ["SCHEDULED","CONFIRMED"].includes(l.status)
  )
  const minutesUntil = nextLesson ? differenceInMinutes(nextLesson.scheduledAt, now) : null

  const timelineItems = todayLessons.map(l => {
    const lh   = l.scheduledAt.getHours() + l.scheduledAt.getMinutes() / 60
    const le   = lh + (l.duration ?? 60) / 60
    const isNext = nextLesson?.id === l.id
    return {
      left:    `${((lh - SH) / SPAN) * 100}%`,
      width:   `${((le - lh)  / SPAN) * 100}%`,
      time:    format(l.scheduledAt, "HH:mm"),
      aluno:   (l.participants[0]?.student.name ?? "Aluno").split(" ")[0],
      materia: l.subject?.name ?? "–",
      modo:    (l.modality === "PRESENCIAL" ? "sede" : "online") as "sede" | "online",
      status:  l.status === "COMPLETED" ? "done"
             : isNext                   ? "next"
             : "soon",
    }
  })

  const nowH    = now.getHours() + now.getMinutes() / 60
  const nowLeft = `${((Math.min(Math.max(nowH, SH), EH) - SH) / SPAN) * 100}%`
  const nowLabel = format(now, "HH:mm")
  const nowVisible = nowH >= SH && nowH <= EH

  // ── Próxima aula hero ─────────────────────────────────────────────────────────
  let hero: {
    lessonId:      string
    hora:          string
    horaFim:       string
    subjectName:   string
    studentName:   string
    studentGrade:  string
    initials:      string
    aulaNum:       number
    topicos:       string
    modality:      "PRESENCIAL" | "ONLINE"
    meetingLink:   string | null
    minutesAte:    number
  } | null = null

  if (nextLesson) {
    const stId      = nextLesson.participants[0]?.studentId
    const aulaNum   = stId
      ? allLessons.filter(l => l.participants[0]?.studentId === stId && l.status === "COMPLETED").length + 1
      : 1
    const stName    = nextLesson.participants[0]?.student.name ?? ""
    const initials  = stName.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "AL"
    const stGrade   = nextLesson.participants[0]?.student.grade ?? "—"
    const endH      = new Date(nextLesson.scheduledAt.getTime() + (nextLesson.duration ?? 60) * 60000)

    hero = {
      lessonId:     nextLesson.id,
      hora:         format(nextLesson.scheduledAt, "HH:mm"),
      horaFim:      format(endH, "HH:mm"),
      subjectName:  nextLesson.subject?.name ?? "–",
      studentName:  stName,
      studentGrade: stGrade,
      initials,
      aulaNum,
      topicos:      nextLesson.topicsCovered ?? nextLesson.subject?.name ?? "–",
      modality:     nextLesson.modality as "PRESENCIAL" | "ONLINE",
      meetingLink:  nextLesson.meetingLink ?? null,
      minutesAte:   minutesUntil ?? 0,
    }
  }

  // ── Avaliações ────────────────────────────────────────────────────────────────
  const avaliacoes = allLessons
    .filter(l => (l.studentRating ?? 0) > 0 && l.studentFeedback)
    .slice(0, 3)
    .map(l => ({
      aluno: (l.participants[0]?.student.name ?? "Aluno").split(" ").slice(0, 2).join(" "),
      nota:  l.studentRating ?? 5,
      txt:   l.studentFeedback ?? "",
      data:  relAgo(l.scheduledAt, now),
    }))

  // ── Ganhos chart (6 meses) ────────────────────────────────────────────────────
  const ganhosMeses = months.map(m => ({
    m: m.label,
    v: allLessons.filter(l => l.status === "COMPLETED" && l.scheduledAt >= m.start && l.scheduledAt <= m.end).length * rate,
  }))
  const ganhosMax = Math.max(...ganhosMeses.map(m => m.v), 1)

  const subjectBreak = new Map<string, { name: string; aulas: number }>()
  for (const l of allLessons.filter(l => l.status === "COMPLETED" && l.scheduledAt >= thisStart)) {
    const sid = l.subjectId ?? "other"
    const cur = subjectBreak.get(sid) ?? { name: l.subject?.name ?? "Outros", aulas: 0 }
    cur.aulas++
    subjectBreak.set(sid, cur)
  }
  const BREAKDOWN_COLORS = ["var(--primary)", "var(--info)", "var(--success)", "var(--warn)"]
  const ganhosBreakdown = Array.from(subjectBreak.values())
    .sort((a, b) => b.aulas - a.aulas)
    .slice(0, 4)
    .map((s, i) => ({ ...s, valor: s.aulas * rate, color: BREAKDOWN_COLORS[i] ?? "var(--subtle)" }))

  const diasAtePagamento = Math.max(1, differenceInDays(endOfMonth(now), now))

  // ── Meus alunos ───────────────────────────────────────────────────────────────
  type AlunoRow = { id: string; name: string; initials: string; grade: string; aulas: number; lastAula: string; content: string; modo: "sede"|"online"; tag: string; tagColor: "success"|"warn"|"danger"|"muted" }
  const studentMap = new Map<string, AlunoRow & { _lastDate: Date }>()

  for (const l of allLessons) {
    const p = l.participants[0]
    if (!p) continue
    const sid = p.studentId
    if (!studentMap.has(sid)) {
      const n = p.student.name ?? "Aluno"
      studentMap.set(sid, {
        id:       sid,
        name:     n,
        initials: n.split(" ").filter(Boolean).slice(0,2).map((s: string)=>s[0]).join("").toUpperCase(),
        grade:    p.student.grade ?? "—",
        aulas:    0,
        lastAula: "—",
        content:  l.subject?.name ?? "–",
        modo:     l.modality === "PRESENCIAL" ? "sede" : "online",
        tag:      "Em dia",
        tagColor: "success",
        _lastDate: l.scheduledAt,
      })
    }
    const s = studentMap.get(sid)!
    if (["COMPLETED","SCHEDULED","CONFIRMED"].includes(l.status)) s.aulas++
    if (l.scheduledAt > s._lastDate || s.aulas === 1) {
      s._lastDate = l.scheduledAt
      s.content   = l.topicsCovered ?? l.subject?.name ?? "–"
      s.modo      = l.modality === "PRESENCIAL" ? "sede" : "online"
    }
    const pkg = p.student.packages?.[0]
    if (pkg && Number(pkg.remainingLessons) <= 2 && s.tag === "Em dia") {
      s.tag = "Renovar"; s.tagColor = "warn"
    }
  }

  const alunos: AlunoRow[] = Array.from(studentMap.values())
    .map(({ _lastDate, ...rest }) => ({ ...rest, lastAula: relDate(_lastDate, now) }))
    .sort((a, b) => b.aulas - a.aulas)
    .slice(0, 15)

  // ── Lições ────────────────────────────────────────────────────────────────────
  type LicaoRow = { id: string; titulo: string; aluno: string; alunoInitials: string; tipo: "lição"|"resumo"|"material"; enviado: string; status: "feito"|"pendente"; sub: string }
  const licoes: LicaoRow[] = []
  for (const l of allLessons) {
    for (const hw of l.homework) {
      const stName = (l.participants[0]?.student.name ?? "Aluno").split(" ").slice(0, 2).join(" ")
      licoes.push({
        id:            hw.id,
        titulo:        hw.title,
        aluno:         stName,
        alunoInitials: stName.split(" ").filter(Boolean).slice(0,2).map((s: string)=>s[0]).join("").toUpperCase(),
        tipo:          "lição",
        enviado:       relAgo(hw.createdAt, now),
        status:        hw.status === "COMPLETED" ? "feito" : "pendente",
        sub:           hw.status === "COMPLETED"
          ? (hw.completedAt ? `concluído ${relAgo(hw.completedAt, now)}` : "concluído")
          : "ainda não entregue",
      })
    }
  }

  return {
    teacherName:     teacher.user.name,
    teacherSubjects: teacher.subjects.map(ts => ts.subject.name),
    aulasHoje, aulasMes, deltaAulas, ganhosMes, avgRating,
    timelineItems, nowLeft, nowLabel, nowVisible, minutesUntil,
    hero,
    avaliacoes,
    totalAvaliacoes: ratedLessons.length,
    ganhosMeses, ganhosMax, ganhosBreakdown,
    diasAtePagamento,
    alunos,
    licoes: licoes.slice(0, 8),
    totalAlunos: studentMap.size,
  }
}

// ─── Timeline tick labels ─────────────────────────────────────────────────────
const TIMELINE_HOURS = [8, 10, 12, 14, 16, 18, 20, 22]
const TIMELINE_SPAN  = 14 // 8 to 22

const TL_COLOR = {
  done: { bg: "var(--success-soft)", border: "var(--success)" },
  next: { bg: "var(--accent-soft)",  border: "var(--primary)" },
  soon: { bg: "var(--info-soft)",    border: "var(--info)"    },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfessorDashboard() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const d = await getProfData(session.user.email)
  if (!d) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        Perfil de professor não encontrado. Contate o administrador.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">

      {/* Header: greeting + 4 MiniStats */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DashboardGreeting
            firstName={d.teacherName.split(" ")[0]}
            subtitle={`${d.aulasHoje} aula${d.aulasHoje !== 1 ? "s" : ""} hoje${d.minutesUntil != null ? ` · próxima em ${d.minutesUntil < 60 ? `${d.minutesUntil} min` : `${Math.floor(d.minutesUntil / 60)}h`}` : ""}`}
          />
        </div>

        {/* 4 MiniStats */}
        <div
          className="flex overflow-hidden rounded-[8px] border border-border"
          style={{ gap: "1px", background: "var(--border)" }}
        >
          {[
            { label: "Aulas hoje",    value: String(d.aulasHoje),  sub: `${d.aulasHoje} total`,          mono: false },
            { label: "Aulas no mês",  value: String(d.aulasMes),   sub: d.deltaAulas != null ? `${d.deltaAulas >= 0 ? "+" : ""}${d.deltaAulas}% vs. mês ant.` : "primeiro mês", mono: false, subPos: d.deltaAulas != null ? d.deltaAulas >= 0 : null },
            { label: "Ganhos do mês", value: brl(d.ganhosMes),     sub: `${d.aulasMes} aulas`,            mono: false },
            { label: "Avaliação",     value: d.avgRating,          sub: `${d.totalAvaliacoes} reviews`,   mono: false },
          ].map(({ label, value, sub, mono, subPos }) => (
            <div key={label} className="min-w-[130px] bg-card px-[16px] py-[10px]">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
              <p
                className="mt-[2px] text-[18px] font-semibold leading-none tracking-[-0.02em]"
                style={{ fontFamily: mono ? "var(--font-mono, ui-monospace)" : "inherit", fontFeatureSettings: '"tnum"' }}
              >
                {value}
              </p>
              <p
                className="mt-[2px] text-[10.5px]"
                style={{ color: subPos === true ? "var(--success)" : subPos === false ? "var(--danger)" : "var(--subtle)" }}
              >
                {sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 p-[14px_18px_6px]">
          <div>
            <p className="text-[13px] font-semibold tracking-[-0.01em]">Linha do dia</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {d.aulasHoje} aula{d.aulasHoje !== 1 ? "s" : ""} hoje
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {(["done","next","soon"] as const).map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: TL_COLOR[s].border }} />
                {["Concluída","Próxima","Agendada"][i]}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline track */}
        <div className="overflow-x-auto px-[18px] pb-[16px]">
          <div className="relative mt-[14px]" style={{ height: 70, minWidth: 600 }}>
            {/* Tick marks */}
            {TIMELINE_HOURS.map((h) => {
              const left = `${((h - 8) / TIMELINE_SPAN) * 100}%`
              return (
                <React.Fragment key={h}>
                  <div
                    className="absolute"
                    style={{ left, top: 22, bottom: 8, width: 1, background: "var(--border)" }}
                  />
                  <div
                    className="absolute font-mono text-[10px]"
                    style={{ left, top: 0, transform: "translateX(-50%)", color: "var(--subtle)" }}
                  >
                    {String(h).padStart(2, "0")}h
                  </div>
                </React.Fragment>
              )
            })}

            {/* Track background */}
            <div
              className="absolute left-0 right-0 rounded-[6px] border border-border"
              style={{ top: 32, height: 38, background: "var(--card-2)" }}
            />

            {/* "Agora" indicator */}
            {d.nowVisible && (
              <div
                className="absolute z-10"
                style={{ left: d.nowLeft, top: 18, bottom: 4, width: 2, background: "var(--danger)" }}
              >
                <div
                  className="absolute rounded-full"
                  style={{ top: -2, left: -4, width: 10, height: 10, background: "var(--danger)" }}
                />
                <div
                  className="absolute left-[6px] font-mono text-[10px] font-semibold whitespace-nowrap"
                  style={{ top: -16, color: "var(--danger)" }}
                >
                  {d.nowLabel}
                </div>
              </div>
            )}

            {/* Lesson blocks */}
            {d.timelineItems.map((item, i) => {
              const c = TL_COLOR[item.status as keyof typeof TL_COLOR]
              return (
                <div
                  key={i}
                  className="absolute z-[2] flex flex-col justify-center overflow-hidden rounded-[4px] px-2 py-1"
                  style={{
                    left:        item.left,
                    width:       item.width,
                    top:         33,
                    height:      36,
                    background:  c.bg,
                    borderLeft:  `3px solid ${c.border}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                    <span className="overflow-hidden text-ellipsis text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                      {item.aluno}
                    </span>
                    <span
                      className="shrink-0 rounded-[2px] px-[4px] py-px font-mono text-[8.5px] font-bold"
                      style={{
                        background: item.modo === "online" ? "var(--info-soft)"  : "var(--muted-soft)",
                        color:      item.modo === "online" ? "var(--info)"       : "var(--text-2)",
                      }}
                    >
                      {item.modo === "online" ? "ON" : "SD"}
                    </span>
                  </div>
                  <div
                    className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px]"
                    style={{ color: "var(--subtle)" }}
                  >
                    {item.time} · {item.materia}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main grid: Left (hero + alunos) | Right (avaliações + ganhos) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_1fr]">

        {/* Left column */}
        <div className="flex flex-col gap-4">

          {/* ProxAulaHero */}
          {d.hero ? (
            <div className="overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="flex items-start justify-between gap-3 p-[12px_14px_0_14px]">
                <div>
                  <p className="text-[13px] font-semibold tracking-[-0.01em]">
                    Próxima aula · em {d.hero.minutesAte < 60 ? `${d.hero.minutesAte} min` : `${Math.floor(d.hero.minutesAte/60)}h`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.hero.hora} — {d.hero.horaFim} · {d.hero.subjectName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ModoBadge modo={d.hero.modality === "PRESENCIAL" ? "sede" : "online"} size="md" />
                  <Link
                    href={`/professor/agenda/${d.hero.lessonId}`}
                    className="rounded-[6px] border border-border bg-card px-3 py-[5px] text-[12px] font-medium transition-colors hover:bg-[var(--hover)]"
                    style={{ color: "var(--text)" }}
                  >
                    + Lição de casa
                  </Link>
                  {d.hero.modality === "ONLINE" && d.hero.meetingLink && (
                    <a
                      href={d.hero.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[6px] px-3 py-[5px] text-[12px] font-semibold text-white transition-opacity hover:opacity-80"
                      style={{ background: "var(--primary)" }}
                    >
                      Abrir sala →
                    </a>
                  )}
                </div>
              </div>

              <div className="grid gap-[14px] p-[12px_14px_14px]" style={{ gridTemplateColumns: "52px 1fr" }}>
                {/* Avatar */}
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] text-[18px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, var(--primary), #ea580c)" }}
                >
                  {d.hero.initials}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <div className="mb-[2px] flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{d.hero.studentName}</span>
                    <span
                      className="rounded-[4px] px-[7px] py-[2px] font-mono text-[10.5px]"
                      style={{ background: "var(--info-soft)", color: "var(--info)" }}
                    >
                      {d.hero.studentGrade}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {d.hero.aulaNum}ª aula
                    </span>
                  </div>
                  <p className="mb-3 text-[12px]" style={{ color: "var(--subtle)" }}>
                    Plano:{" "}
                    <span style={{ color: "var(--text-2)" }}>{d.hero.topicos}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div className="rounded-[7px] p-[10px]" style={{ background: "var(--card-2)" }}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                        Histórico recente
                      </p>
                      <p style={{ color: "var(--text-2)", lineHeight: 1.4 }}>
                        {d.hero.aulaNum > 1
                          ? `${Math.min(d.hero.aulaNum - 1, 3)} aula${d.hero.aulaNum > 2 ? "s" : ""} anterior${d.hero.aulaNum > 2 ? "es" : ""}`
                          : "Primeira aula com este aluno"}
                      </p>
                    </div>
                    <div className="rounded-[7px] p-[10px]" style={{ background: "var(--card-2)" }}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                        Próxima aula
                      </p>
                      <p style={{ color: "var(--text-2)", lineHeight: 1.4 }}>
                        {d.hero.hora} — {d.hero.horaFim} · {d.hero.subjectName}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-[10px] border border-border bg-card py-8 text-[12.5px] text-muted-foreground"
            >
              Nenhuma aula agendada para as próximas horas
            </div>
          )}

          {/* MeusAlunos (client, with tabs) */}
          <MeusAlunos
            alunos={d.alunos}
            licoes={d.licoes}
            totalAlunos={d.totalAlunos}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Avaliações */}
          <div className="overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
              <div>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">Avaliações recentes</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.totalAvaliacoes} avaliações{d.avgRating !== "–" ? ` · média ${d.avgRating}` : ""}
                </p>
              </div>
              <span className="text-[11px] font-medium" style={{ color: "var(--primary)" }}>
                Ver todas →
              </span>
            </div>
            <div className="flex flex-col gap-[10px] px-[16px] pb-[14px]">
              {d.avaliacoes.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-muted-foreground">
                  Nenhuma avaliação ainda
                </p>
              ) : (
                d.avaliacoes.map((r, i) => (
                  <div key={i} className="rounded-[7px] p-[10px_12px]" style={{ background: "var(--card-2)" }}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-medium">{r.aluno}</span>
                        <span className="text-[11px]" style={{ color: "var(--primary)" }}>
                          {"★".repeat(r.nota)}
                          <span style={{ color: "var(--subtle)" }}>{"★".repeat(Math.max(0, 5 - r.nota))}</span>
                        </span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground">{r.data}</span>
                    </div>
                    <p className="text-[12px] leading-[1.4]" style={{ color: "var(--text-2)" }}>
                      &ldquo;{r.txt}&rdquo;
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ganhos */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
            <div className="p-[12px_14px_8px]">
              <p className="text-[13px] font-semibold tracking-[-0.01em]">Meus ganhos · {format(new Date(), "MMMM", { locale: ptBR })}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.aulasMes} aulas · próximo pagamento em ~{d.diasAtePagamento} dias
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-[14px] px-[18px] pb-[16px]">
              {/* Big number */}
              <div className="flex items-baseline gap-3">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.025em]" style={{ fontFeatureSettings: '"tnum"' }}>
                  {brl(d.ganhosMes)}
                </span>
                {d.deltaAulas != null && (
                  <span
                    className="rounded-[4px] px-[7px] py-[2px] font-mono text-[11px]"
                    style={{
                      background: d.deltaAulas >= 0 ? "var(--success-soft)" : "var(--danger-soft)",
                      color:      d.deltaAulas >= 0 ? "var(--success)"      : "var(--danger)",
                    }}
                  >
                    {d.deltaAulas >= 0 ? "▲" : "▼"} {Math.abs(d.deltaAulas)}%
                  </span>
                )}
              </div>

              {/* Bar chart (6 months) */}
              <div className="flex h-[72px] items-end gap-1.5">
                {d.ganhosMeses.map((m, i) => {
                  const hPct = d.ganhosMax > 0 ? (m.v / d.ganhosMax) * 100 : 0
                  const isCurrent = i === d.ganhosMeses.length - 1
                  return (
                    <div key={m.m} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-[3px]"
                        style={{
                          height:     `${Math.max(hPct, 4)}%`,
                          background: isCurrent ? "var(--primary)" : "var(--border-strong)",
                        }}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">{m.m}</span>
                    </div>
                  )
                })}
              </div>

              {/* Breakdown by subject */}
              {d.ganhosBreakdown.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                    Por matéria
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {d.ganhosBreakdown.map((b, i) => (
                      <div key={i} className="grid items-center gap-2 text-[12px]" style={{ gridTemplateColumns: "80px 1fr auto auto" }}>
                        <span style={{ color: "var(--text-2)" }} className="truncate">{b.name}</span>
                        <div className="h-[6px] overflow-hidden rounded-[2px]" style={{ background: "var(--border)" }}>
                          <div
                            style={{
                              width:      d.ganhosMes > 0 ? `${(b.valor / d.ganhosMes) * 100}%` : "0%",
                              height:     "100%",
                              background: b.color,
                            }}
                          />
                        </div>
                        <span className="text-right" style={{ fontFeatureSettings: '"tnum"' }}>
                          {brl(b.valor)}
                        </span>
                        <span className="text-right text-muted-foreground">{b.aulas}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
