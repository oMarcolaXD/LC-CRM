import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { redirect }         from "next/navigation"
import { getActiveStudent } from "@/lib/get-active-student"
import { ModoBadge }        from "@/components/shared/modo-badge"
import { DashboardGreeting } from "@/components/shared/dashboard-greeting"
import Link                 from "next/link"
import { format }           from "date-fns"
import { ptBR }             from "date-fns/locale"
import { formatBR, nowBrazil } from "@/lib/datetime"

function brlFmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function initials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

async function getRespData(guardianUserId: string) {
  const { guardian, student: activeStudent, allStudents } = await getActiveStudent(guardianUserId)
  if (!guardian || allStudents.length === 0) return null

  const studentIds = allStudents.map((s) => s.id)
  const now        = nowBrazil()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    proximasAulas,
    packages,
    solicitacoes,
    aulasCom,
    pagamentos,
    unreadCount,
    completedRaw,
  ] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        participants: { some: { studentId: { in: studentIds } } },
        status:      { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      include: {
        subject:      true,
        teacher:      { include: { user: true } },
        participants: { include: { student: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
    prisma.lessonPackage.findMany({
      where:   { studentId: { in: studentIds }, status: "ACTIVE" },
      include: { student: true },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.lessonRequest.findMany({
      where:   { studentId: { in: studentIds }, status: "PENDING" },
      include: { subject: true, teacher: { include: { user: true } }, student: true },
      orderBy: { requestedAt: "desc" },
      take: 5,
    }),
    prisma.lesson.findMany({
      where: {
        participants: { some: { studentId: { in: studentIds } } },
        status:       "COMPLETED",
        teacherNotes: { not: null },
      },
      include: {
        subject:      true,
        teacher:      { include: { user: true } },
        participants: { include: { student: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 6,
    }),
    prisma.payment.findMany({
      where:   { studentId: { in: studentIds } },
      include: { student: true },
      orderBy: { dueDate: "desc" },
      take: 10,
    }),
    prisma.notification.count({ where: { userId: guardianUserId, read: false } }),
    prisma.lesson.findMany({
      where: {
        participants: { some: { studentId: { in: studentIds } } },
        status:       "COMPLETED",
        scheduledAt:  { gte: monthStart, lte: now },
      },
      select: { participants: { select: { studentId: true } } },
    }),
  ])

  const completedByStudent: Record<string, number> = {}
  for (const l of completedRaw) {
    for (const p of l.participants) {
      if (studentIds.includes(p.studentId)) {
        completedByStudent[p.studentId] = (completedByStudent[p.studentId] ?? 0) + 1
      }
    }
  }

  return {
    guardian,
    activeStudent,
    allStudents,
    proximasAulas,
    packages,
    solicitacoes,
    aulasCom,
    pagamentos,
    unreadCount,
    completedByStudent,
    now,
  }
}

const STUDENT_COLORS = ["var(--primary)", "#0ea5e9", "#8b5cf6", "#10b981"]

export default async function AlunoDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const d = await getRespData(session.user.id)
  if (!d?.activeStudent) redirect("/aluno/sem-aluno")

  const {
    activeStudent, allStudents, proximasAulas, packages,
    solicitacoes, aulasCom, pagamentos, unreadCount, completedByStudent, now,
  } = d

  const studentIds = allStudents.map((s) => s.id)
  const studentColorMap: Record<string, string> = {}
  allStudents.forEach((s, i) => { studentColorMap[s.id] = STUDENT_COLORS[i % STUDENT_COLORS.length] })

  const guardianFirstName = (session.user.name ?? "").split(" ")[0]

  // Next lesson per student
  const studentNextLesson: Record<string, typeof proximasAulas[0] | undefined> = {}
  for (const s of allStudents) {
    studentNextLesson[s.id] = proximasAulas.find((l) => l.participants.some((p) => p.studentId === s.id))
  }

  // Greeting context line
  const contextParts = allStudents.flatMap((s) => {
    const next = studentNextLesson[s.id]
    if (!next) return []
    const fn   = s.name.split(" ")[0]
    const ms   = next.scheduledAt.getTime() - now.getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 60)   return [`${fn} tem aula em ${mins} min`]
    if (mins < 1440) return [`${fn} tem aula hoje às ${formatBR(next.scheduledAt, "HH:mm")}`]
    return [`${fn} tem aula em ${Math.floor(mins / 1440)} dia${Math.floor(mins / 1440) !== 1 ? "s" : ""}`]
  })

  // Active package for the selected child
  const heroLesson    = studentNextLesson[activeStudent.id]
  const activePackage = packages.find((p) => p.studentId === activeStudent.id)
  const usedLessons   = activePackage ? Number(activePackage.totalLessons) - Number(activePackage.remainingLessons) : 0
  const displaySlots  = activePackage ? Math.min(Number(activePackage.totalLessons), 12) : 12
  const filledSlots   = activePackage && Number(activePackage.totalLessons) > 0
    ? Math.round((usedLessons / Number(activePackage.totalLessons)) * displaySlots)
    : 0

  let paceStr: string | null = null
  if (activePackage && usedLessons > 0) {
    const weeksSince = (now.getTime() - new Date(activePackage.purchaseDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
    if (weeksSince >= 0.5) {
      const pace = usedLessons / weeksSince
      if (pace > 0) paceStr = `~${Math.round((Number(activePackage.remainingLessons) / pace) * 7)} dias`
    }
  }

  const otherStudents  = allStudents.filter((s) => s.id !== activeStudent.id)
  const otherStudent   = otherStudents[0]
  const otherPackage   = otherStudent ? packages.find((p) => p.studentId === otherStudent.id) : null
  const otherNextLesson = otherStudent ? studentNextLesson[otherStudent.id] : undefined

  // Teacher notes grouped by teacher (most recent per teacher)
  const notesByTeacher = new Map<string, typeof aulasCom[0]>()
  for (const l of aulasCom) {
    if (!notesByTeacher.has(l.teacherId)) notesByTeacher.set(l.teacherId, l)
  }
  const mensagens = Array.from(notesByTeacher.values()).slice(0, 3)

  // Payments
  const nextPayment  = pagamentos.find((p) => p.status === "PENDING" || p.status === "OVERDUE")
  const paidHistory  = pagamentos.filter((p) => p.status === "PAID").slice(0, 3)
  const daysUntilDue = nextPayment
    ? Math.round((nextPayment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const heroIsToday = heroLesson && heroLesson.scheduledAt.toDateString() === now.toDateString()

  return (
    <div className="flex flex-col gap-[22px]">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <DashboardGreeting
            firstName={guardianFirstName}
            subtitle={contextParts.length > 0 ? contextParts.join(". ") : undefined}
          />
        </div>
        {unreadCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>
              {unreadCount} notificaç{unreadCount !== 1 ? "ões" : "ão"} não lida{unreadCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── FilhoHero ────────────────────────────────────────────────────── */}
      <div
        className={`grid gap-px overflow-hidden rounded-[14px] border border-border bg-border grid-cols-1 ${otherStudent ? "sm:grid-cols-[1.3fr_1fr_1fr]" : "sm:grid-cols-[1.3fr_1fr]"}`}
      >

        {/* Col 1 — Próxima aula */}
        <div style={{ background: "var(--card)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10.5, padding: "3px 9px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--primary)", fontWeight: 600, letterSpacing: "0.02em" }}>
            PRÓXIMA AULA · {activeStudent.name.split(" ")[0].toUpperCase()}
          </div>

          {heroLesson ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, var(--primary), #ea580c)", color: "#fff", fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, opacity: 0.85 }}>{heroIsToday ? "HOJE" : format(heroLesson.scheduledAt, "dd/MM")}</span>
                  <span style={{ fontSize: 16, fontFamily: "ui-monospace, monospace", marginTop: 2 }}>{formatBR(heroLesson.scheduledAt, "HH:mm")}</span>
                </div>
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>{heroLesson.subject?.name ?? "–"}</div>
                    <ModoBadge modo={heroLesson.modality === "ONLINE" ? "online" : "sede"} size="md" />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--subtle)", marginTop: 2 }}>
                    com <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{heroLesson.teacher.user.name}</span> · {heroLesson.duration} min
                  </div>
                </div>
              </div>

              {heroLesson.topicsCovered && (
                <div style={{ padding: 12, background: "var(--card-2)", borderRadius: 9, fontSize: 12.5, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 10.5, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: 3 }}>O que vão estudar</div>
                  <span style={{ color: "var(--text-2)" }}>{heroLesson.topicsCovered}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                {heroLesson.modality === "ONLINE" && heroLesson.meetingLink ? (
                  <a href={heroLesson.meetingLink} target="_blank" rel="noreferrer"
                    style={{ padding: "9px 14px", borderRadius: 8, background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", flex: 1, textAlign: "center" }}>
                    Entrar na sala →
                  </a>
                ) : (
                  <span style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 13, flex: 1, textAlign: "center", color: "var(--subtle)" }}>
                    {heroLesson.modality === "PRESENCIAL" ? "Aula presencial" : "Link em breve"}
                  </span>
                )}
                <Link href="/aluno/aulas"
                  style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 13, textDecoration: "none", color: "var(--text-2)" }}>
                  Ver agenda
                </Link>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8, color: "var(--subtle)", fontSize: 13, textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>📅</div>
              <div>Nenhuma aula agendada</div>
              <Link href="/aluno/agendar"
                style={{ padding: "8px 16px", borderRadius: 8, background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                Agendar aula
              </Link>
            </div>
          )}
        </div>

        {/* Col 2 — Pacote */}
        <div style={{ background: "var(--card)", padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 12 }}>
            Pacote de {activeStudent.name.split(" ")[0]}
          </div>

          {activePackage ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em", fontFamily: "ui-monospace, monospace", color: "var(--primary)" }}>
                  {Number(activePackage.remainingLessons)}
                </span>
                <span style={{ fontSize: 14, color: "var(--subtle)" }}>
                  aulas restantes <span style={{ color: "var(--subtle)" }}>· de {Number(activePackage.totalLessons)}</span>
                </span>
              </div>

              <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                {Array.from({ length: displaySlots }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 22, borderRadius: 3, background: i < filledSlots ? "var(--primary)" : "var(--card-2)", border: i < filledSlots ? "none" : "1px dashed var(--border-strong)" }} />
                ))}
              </div>

              <div style={{ fontSize: 12, color: "var(--subtle)", lineHeight: 1.5, marginBottom: 14 }}>
                {paceStr
                  ? <>Estimativa: pacote acaba em <b style={{ color: "var(--text)", fontFamily: "ui-monospace, monospace" }}>{paceStr}</b>.</>
                  : <>{Number(activePackage.remainingLessons)} aulas restantes no pacote atual.</>
                }
              </div>

              <Link href="/aluno/pagamentos"
                style={{ display: "block", textAlign: "center", padding: 9, borderRadius: 8, border: "1px solid var(--primary)", color: "var(--primary)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                Renovar pacote
              </Link>
            </>
          ) : (
            <div style={{ color: "var(--subtle)", fontSize: 13 }}>
              Nenhum pacote ativo.{" "}
              <Link href="/aluno/pagamentos" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>Contratar →</Link>
            </div>
          )}
        </div>

        {/* Col 3 — Resumo do outro filho (se existir) */}
        {otherStudent && (
          <div style={{ background: "var(--card)", padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                Resumo de {otherStudent.name.split(" ")[0]}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--info)", fontFamily: "ui-monospace, monospace" }}>{otherStudent.grade}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {/* Próxima aula */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>Próxima aula</div>
                  <div style={{ fontSize: 10.5, color: "var(--subtle)" }}>
                    {otherNextLesson ? `${otherNextLesson.subject?.name ?? "–"} · ${otherNextLesson.teacher.user.name}` : "—"}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, monospace", letterSpacing: "-0.01em" }}>
                  {otherNextLesson ? formatBR(otherNextLesson.scheduledAt, "EEE · HH:mm", { locale: ptBR }) : "—"}
                </div>
              </div>

              {/* Pacote */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>Pacote</div>
                  <div style={{ fontSize: 10.5, color: "var(--subtle)" }}>
                    {otherPackage ? `${Number(otherPackage.remainingLessons)} restantes` : "sem pacote ativo"}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                  {otherPackage ? `${Number(otherPackage.totalLessons) - Number(otherPackage.remainingLessons)} / ${Number(otherPackage.totalLessons)}` : "—"}
                </div>
              </div>

              {/* Aulas este mês */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>Este mês</div>
                  <div style={{ fontSize: 10.5, color: "var(--subtle)" }}>aulas realizadas</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                  {completedByStudent[otherStudent.id] ?? 0}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Two-column body ───────────────────────────────────────────────── */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1.45fr_1fr]">

        {/* Left ── Próximas aulas + Solicitações */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Próximas aulas da família */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px 10px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Próximas aulas</div>
                <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                  {proximasAulas.length} aula{proximasAulas.length !== 1 ? "s" : ""} agendada{proximasAulas.length !== 1 ? "s" : ""}
                  {solicitacoes.length > 0 ? ` · ${solicitacoes.length} aguardando confirmação` : ""}
                </div>
              </div>
              <Link href="/aluno/aulas" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}>
                Ver agenda →
              </Link>
            </div>

            <div className="overflow-auto">
              {proximasAulas.length === 0 ? (
                <div style={{ padding: "32px 14px", textAlign: "center", color: "var(--subtle)", fontSize: 13 }}>
                  Nenhuma aula agendada nos próximos dias
                </div>
              ) : (
                proximasAulas.slice(0, 6).map((l, i) => {
                  const participant  = l.participants.find((p) => studentIds.includes(p.studentId))
                  const studentName  = participant?.student?.name ?? ""
                  const studentId    = participant?.studentId ?? ""
                  const color        = studentColorMap[studentId] ?? "var(--primary)"
                  const isToday      = l.scheduledAt.toDateString() === now.toDateString()
                  return (
                    <div key={l.id} style={{ display: "grid", gridTemplateColumns: "110px 26px 1fr auto", alignItems: "center", gap: 14, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "ui-monospace, monospace", color: isToday ? "var(--primary)" : "var(--text)" }}>
                        {isToday ? `Hoje · ${formatBR(l.scheduledAt, "HH:mm")}` : formatBR(l.scheduledAt, "EEE · HH:mm", { locale: ptBR })}
                      </span>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: color, color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {initials(studentName)}
                      </div>
                      <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {studentName.split(" ")[0]} · <span style={{ color: "var(--text-2)" }}>{l.subject?.name ?? "–"}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--subtle)" }}>com {l.teacher.user.name}</div>
                      </div>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <ModoBadge modo={l.modality === "ONLINE" ? "online" : "sede"} size="sm" />
                        <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, fontFamily: "ui-monospace, monospace", background: l.status === "CONFIRMED" ? "var(--success-soft)" : "var(--warn-soft)", color: l.status === "CONFIRMED" ? "var(--success)" : "var(--warn)" }}>
                          {l.status === "CONFIRMED" ? "confirmada" : "agendada"}
                        </span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Solicitações pendentes */}
          <div className="rounded-[10px] border border-border bg-card overflow-hidden">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px 10px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Suas solicitações</div>
                <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                  {solicitacoes.length > 0 ? `${solicitacoes.length} aguardando · respostas em até 24h` : "Nenhuma solicitação pendente"}
                </div>
              </div>
              <Link href="/aluno/agendar"
                style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--primary)", color: "var(--primary)", fontSize: 12.5, fontWeight: 500, textDecoration: "none" }}>
                + Nova solicitação
              </Link>
            </div>

            <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {solicitacoes.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--subtle)", fontSize: 13, padding: "12px 0" }}>
                  Nenhuma solicitação em aberto
                </div>
              ) : (
                solicitacoes.map((r) => {
                  const horasAtras = Math.floor((now.getTime() - r.requestedAt.getTime()) / (1000 * 60 * 60))
                  const dotColor   = horasAtras < 2  ? "var(--primary)" : horasAtras < 12 ? "var(--warn)" : "var(--danger)"
                  const bgColor    = horasAtras < 2  ? "var(--accent-soft)" : horasAtras < 12 ? "var(--warn-soft)" : "var(--danger-soft)"
                  const timeLabel  = horasAtras < 1  ? "< 1h" : horasAtras < 24 ? `há ${horasAtras}h` : `há ${Math.floor(horasAtras / 24)}d`
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--card-2)", borderRadius: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, lineHeight: 1.35, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {r.student.name.split(" ")[0]} · <span style={{ color: "var(--text-2)", fontWeight: 400 }}>{r.subject?.name ?? "Aula"}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--subtle)" }}>
                          {timeLabel} · {formatBR(r.preferredAt, "dd/MM HH:mm")}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, fontFamily: "ui-monospace, monospace", background: bgColor, color: dotColor, flexShrink: 0 }}>
                        recebida
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right ── Recados dos professores + Pagamentos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Recados dos professores */}
          <div className="rounded-[10px] border border-border bg-card overflow-hidden">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px 10px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Recados dos professores</div>
                <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                  {mensagens.length > 0 ? `${mensagens.length} nota${mensagens.length !== 1 ? "s" : ""} recente${mensagens.length !== 1 ? "s" : ""}` : "Nenhum recado ainda"}
                </div>
              </div>
            </div>

            <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column" }}>
              {mensagens.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--subtle)", fontSize: 13, padding: "12px 0 4px" }}>
                  Os professores postarão recados após as aulas
                </div>
              ) : (
                mensagens.map((l, i) => {
                  const participant       = l.participants.find((p) => studentIds.includes(p.studentId))
                  const studentFirstName  = participant?.student?.name?.split(" ")[0] ?? ""
                  const isFirst           = i === 0
                  const note              = l.teacherNotes ?? ""
                  return (
                    <div key={l.id} style={{ display: "flex", gap: 11, padding: "12px 4px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {initials(l.teacher.user.name)}
                        {isFirst && <span style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: "var(--primary)", border: "2px solid var(--card)" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: isFirst ? 600 : 500 }}>{l.teacher.user.name}</span>
                          <span style={{ fontSize: 10.5, color: "var(--subtle)" }}>· {l.subject?.name ?? "–"} · {studentFirstName}</span>
                          <span style={{ fontSize: 10.5, color: "var(--subtle)", marginLeft: "auto" }}>
                            {format(l.scheduledAt, "dd/MM", { locale: ptBR })}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: isFirst ? "var(--text)" : "var(--text-2)" }}>
                          {note.slice(0, 120)}{note.length > 120 ? "…" : ""}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pagamentos */}
          <div className="flex flex-col rounded-[10px] border border-border bg-card overflow-hidden">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px 10px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Pagamentos</div>
                <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                  {nextPayment ? `Próximo vencimento · ${format(nextPayment.dueDate, "dd/MM/yyyy")}` : "Sem cobranças pendentes"}
                </div>
              </div>
            </div>

            <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              {nextPayment && (
                <div style={{ padding: 16, background: "var(--accent-soft)", borderRadius: 9, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {nextPayment.status === "OVERDUE" ? "Cobrança vencida" : "Próximo pagamento"}
                    </span>
                    {daysUntilDue !== null && (
                      <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "var(--card)", fontFamily: "ui-monospace, monospace", fontWeight: 600, color: nextPayment.status === "OVERDUE" ? "var(--danger)" : "var(--primary)" }}>
                        {nextPayment.status === "OVERDUE" ? `${Math.abs(daysUntilDue)}d atrasado` : `em ${daysUntilDue} dias`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", fontFamily: "ui-monospace, monospace" }}>
                      {brlFmt(Number(nextPayment.amount))}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--accent-ink)" }}>
                      {nextPayment.description ?? `Pacote · ${nextPayment.student.name.split(" ")[0]}`}
                    </span>
                  </div>
                  <Link href="/aluno/pagamentos"
                    style={{ display: "inline-block", marginTop: 10, padding: "8px 14px", borderRadius: 7, background: "var(--primary)", color: "#fff", fontSize: 12.5, fontWeight: 500, textDecoration: "none" }}>
                    Ver detalhes
                  </Link>
                </div>
              )}

              {paidHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500, marginBottom: 8 }}>Histórico recente</div>
                  {paidHistory.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <div style={{ flex: 1, lineHeight: 1.3 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                          {p.description ?? `Pacote · ${p.student.name.split(" ")[0]}`}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--subtle)", fontFamily: "ui-monospace, monospace" }}>
                          {p.paidAt ? format(p.paidAt, "dd/MM/yy") : format(p.dueDate, "dd/MM/yy")}
                        </div>
                      </div>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{brlFmt(Number(p.amount))}</span>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, fontFamily: "ui-monospace, monospace", background: "var(--success-soft)", color: "var(--success)" }}>pago</span>
                    </div>
                  ))}
                </div>
              )}

              {!nextPayment && paidHistory.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--subtle)", fontSize: 13, padding: "12px 0" }}>
                  Nenhum histórico de pagamento
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
