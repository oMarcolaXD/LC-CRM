import { prisma }        from "@/lib/prisma"
import type { Prisma }   from "@prisma/client"
import { auth }          from "@/lib/auth"
import { notFound }      from "next/navigation"
import Link             from "next/link"
import { HistoryPagination } from "@/components/shared/history-pagination"
import { format, formatDistanceToNow, subDays, differenceInMonths } from "date-fns"
import { ptBR }         from "date-fns/locale"
import { buttonVariants } from "@/components/ui/button"
import { Badge }         from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GraduationCap, UserRound, Phone, Mail, CalendarDays,
  BookOpen, MessageCircle, School,
  CreditCard, ChevronLeft, ChevronRight, Star,
  Tag, FileText, Plus, Check,
} from "lucide-react"
import { LessonHeatmap, type HeatmapEntry }    from "./_components/lesson-heatmap"
import { ScheduleLessonDialog }               from "./_components/schedule-lesson-dialog"
import { PackageDialog }                      from "./_components/package-dialog"
import { EditStudentDialog }                  from "./_components/edit-student-dialog"
import { RegisterPastLessonDialog }           from "./_components/register-past-lesson-dialog"
import { BatchPastLessonsDialog }             from "./_components/batch-past-lessons-dialog"
import { EditPackageDialog }                  from "./_components/edit-package-dialog"
import { EditLessonDialog }                   from "./_components/edit-lesson-dialog"
import { DeleteLessonButton }                from "./_components/delete-lesson-button"
import { RequestCancellationButton }         from "./_components/request-cancellation-button"
import { AddPaymentDialog }                   from "./_components/add-payment-dialog"
import { DeletePaymentButton }               from "./_components/delete-payment-button"
import { ReceiptDialog }                     from "./_components/receipt-dialog"
import { PaymentStatusSelector }             from "./_components/payment-status-selector"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtLessons(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function avatarColor(name: string) {
  const colors = [
    "bg-orange-500","bg-blue-500","bg-emerald-500","bg-violet-500",
    "bg-rose-500","bg-amber-500","bg-cyan-500","bg-indigo-500",
  ]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return colors[hash % colors.length]
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  )
}

const LESSON_STATUS = {
  SCHEDULED:  { label: "Agendada",   cls: "bg-amber-100 text-amber-700 border-amber-200"    },
  CONFIRMED:  { label: "Confirmada", cls: "bg-[#219EBC]/10 text-brand-blue border-brand-blue/30" },
  COMPLETED:  { label: "Realizada",  cls: "bg-slate-100 text-slate-600 border-slate-200"    },
  CANCELLED:  { label: "Cancelada",  cls: "bg-red-100 text-red-600 border-red-200"          },
  MISSED:     { label: "Faltou",     cls: "bg-orange-100 text-orange-700 border-orange-200" },
} as const


// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; success?: string; aulas?: string; pagamentos?: string; page?: string }>
}

const HISTORY_PER_PAGE = 15

export default async function StudentDetailPage({ params, searchParams }: Props) {
  const { id }  = await params
  const { tab, success, aulas, pagamentos, page: pageParam } = await searchParams
  const session = await auth()
  const isAdmin = session?.user?.role === "ADMIN"

  // Step 1 — lightweight fetch for cursor-based prev/next
  const base = await prisma.student.findUnique({ where: { id }, select: { name: true } })
  if (!base) notFound()

  // Histórico paginado (respeita a aba selecionada)
  const historyPage   = Math.max(1, Number(pageParam) || 1)
  const historyStatus: "COMPLETED" | "MISSED" | undefined =
    tab === "realizadas" ? "COMPLETED" : tab === "faltas" ? "MISSED" : undefined
  const historyWhere: Prisma.LessonWhereInput = {
    participants: { some: { studentId: id } },
    ...(historyStatus ? { status: historyStatus } : {}),
  }

  // Step 2 — all queries in a single transaction (1 connection, sequential)
  const [
    student,
    totalDone,
    totalMissed,
    totalInvestedAgg,
    heatmapLessons,
    recentLessons,
    prevStudent,
    nextStudent,
    totalStudents,
    teachersRaw,
    allStudentsRaw,
    historyLessons,
    historyCount,
  ] = await prisma.$transaction([
    prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        guardian: { include: { user: true } },
        packages:     { orderBy: { purchaseDate: "asc" } },
        payments:     { orderBy: { dueDate: "desc" }, take: 10 },
        studentNotes: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    prisma.lesson.count({
      where: { participants: { some: { studentId: id } }, status: "COMPLETED" },
    }),
    prisma.lesson.count({
      where: { participants: { some: { studentId: id } }, status: "MISSED" },
    }),
    prisma.payment.aggregate({
      where: { studentId: id, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.lesson.findMany({
      where: {
        participants: { some: { studentId: id } },
        scheduledAt: { gte: subDays(new Date(), 91) },
      },
      select: { scheduledAt: true, status: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.lesson.findMany({
      where: { participants: { some: { studentId: id } } },
      select: {
        id: true, scheduledAt: true, status: true,
        subjectId: true, modality: true, duration: true,
        topicsCovered: true, teacherNotes: true, studentRating: true,
        subject: { select: { name: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
    prisma.student.findFirst({
      where: { name: { lt: base.name } },
      orderBy: { name: "desc" },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { name: { gt: base.name } },
      orderBy: { name: "asc" },
      select: { id: true },
    }),
    prisma.student.count(),
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      select: {
        id: true,
        user:     { select: { name: true } },
        subjects: { select: { subject: { select: { id: true, name: true } } } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.student.findMany({
      where:   { id: { not: id } },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      take:    200,
    }),
    // Histórico paginado (aba + página)
    prisma.lesson.findMany({
      where: historyWhere,
      select: {
        id: true, scheduledAt: true, status: true,
        subjectId: true, modality: true, duration: true,
        topicsCovered: true, teacherNotes: true, studentRating: true,
        subject: { select: { name: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      skip:    (historyPage - 1) * HISTORY_PER_PAGE,
      take:    HISTORY_PER_PAGE,
    }),
    prisma.lesson.count({ where: historyWhere }),
  ])

  const historyTotalPages = Math.ceil(historyCount / HISTORY_PER_PAGE)

  if (!student) notFound()

  // ─── Computed values ─────────────────────────────────────────────────────

  const activePkg   = student.packages.find(p => p.status === "ACTIVE") ?? null
  const pkgIndex    = student.packages.findIndex(p => p.status === "ACTIVE")
  const packageCode = pkgIndex >= 0 ? `PKT-${String(pkgIndex + 1).padStart(3, "0")}` : null

  const frequency   = Math.round(totalDone / Math.max(1, totalDone + totalMissed) * 100)
  const totalInvested = Number(totalInvestedAgg._sum.amount ?? 0)
  const createdAt   = student.createdAt
  const monthsActive = Math.max(1, differenceInMonths(new Date(), createdAt))
  const ltvProjected  = Math.round(totalInvested / monthsActive * 12)

  const now = new Date()
  const nextLesson = [...recentLessons]
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .find(l => l.scheduledAt > now && (l.status === "SCHEDULED" || l.status === "CONFIRMED"))

  // Teachers for ScheduleLessonDialog & RegisterPastLessonDialog
  const teachersForDialog = teachersRaw.map(t => ({
    id:       t.id,
    name:     t.user.name,
    subjects: t.subjects.map(s => ({ id: s.subject.id, name: s.subject.name })),
  }))

  // Pacotes ativos (para o selo/seletor de pacote no "Registrar aula")
  const activePackages = student.packages
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.status === "ACTIVE" && Number(p.remainingLessons) > 0)
    .map(({ p, idx }) => ({
      id:        p.id,
      label:     `PKT-${String(idx + 1).padStart(3, "0")}`,
      remaining: Number(p.remainingLessons),
    }))

  // Teachers map from recent 20 lessons
  const teachersMap = new Map<string, { name: string; count: number; lastAt: Date }>()
  for (const l of recentLessons) {
    const t = l.teacher
    if (!t) continue
    const existing = teachersMap.get(t.id)
    if (existing) {
      existing.count++
      if (l.scheduledAt > existing.lastAt) existing.lastAt = l.scheduledAt
    } else {
      teachersMap.set(t.id, { name: t.user.name, count: 1, lastAt: l.scheduledAt })
    }
  }
  const teachersList = [...teachersMap.values()].sort((a, b) => b.count - a.count)

  // Heatmap entries
  const heatmapEntries: HeatmapEntry[] = heatmapLessons.map(l => ({
    date:   l.scheduledAt.toISOString(),
    status: l.status,
  }))

  // Filtered lessons for table — vem paginado do banco (respeita a aba)
  const filteredLessons = historyLessons

  // Payments serialized for client dialog (Decimal → number, Date → ISO string)
  const paymentsForReceipt = student.payments.map(p => ({
    id:          p.id,
    amount:      Number(p.amount),
    dueDate:     p.dueDate.toISOString(),
    paidAt:      p.paidAt?.toISOString() ?? null,
    method:      p.method,
    description: p.description,
    status:      p.status,
  }))

  // Contact info
  const guardian     = student.guardian
  const guardianUser = guardian?.user ?? null
  const guardianPhone = guardianUser?.phone?.replace(/\D/g, "") ?? null
  const studentPhone  = student.user?.phone?.replace(/\D/g, "") ?? null
  const whatsappPhone = guardianPhone ?? studentPhone

  // Student nav position (approximate from cursor — just counts from a count query)
  // We show ← / → without exact index to avoid the full-table-scan
  const BASE_PATH = "/colaborador/alunos"

  const isInactive = student.user?.active === false

  return (
    <div className="space-y-4">

      {/* ── Banner de digitalização bem-sucedida ────────────────────────────── */}
      {success === "digitalizado" && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
          <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold">Ficha digitalizada com sucesso!</p>
            <p className="text-xs text-green-700 mt-0.5">
              {Number(aulas) > 0 && <>{aulas} aula{Number(aulas) !== 1 ? "s" : ""} importada{Number(aulas) !== 1 ? "s" : ""}</>}
              {Number(aulas) > 0 && Number(pagamentos) > 0 && " · "}
              {Number(pagamentos) > 0 && <>{pagamentos} pagamento{Number(pagamentos) !== 1 ? "s" : ""} registrado{Number(pagamentos) !== 1 ? "s" : ""}</>}
              {Number(aulas) === 0 && Number(pagamentos) === 0 && "Aluno cadastrado no sistema."}
              {" "}Confira os dados abaixo.
            </p>
          </div>
        </div>
      )}

      {/* ── Breadcrumb + navegação ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href={BASE_PATH} className="hover:text-foreground transition-colors">Alunos</Link>
          <span className="mx-1">/</span>
          <span className="text-foreground font-medium">{student.name}</span>
        </nav>
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          {prevStudent && (
            <Link
              href={`${BASE_PATH}/${prevStudent.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" }) + " h-7 w-7 p-0"}
              title="Aluno anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
          )}
          <span className="text-xs tabular-nums">{totalStudents} alunos</span>
          {nextStudent && (
            <Link
              href={`${BASE_PATH}/${nextStudent.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" }) + " h-7 w-7 p-0"}
              title="Próximo aluno"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Avatar */}
          <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${avatarColor(student.name)}`}>
            {initials(student.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="font-sub text-xl font-bold">{student.name}</h1>
              {isInactive && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                  Ex-aluno
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activePkg ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {activePkg ? "Ativa" : "Sem pacote"}
              </span>
              {activePkg && Number(activePkg.remainingLessons) <= 4 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                  {Number(activePkg.remainingLessons) <= 1 ? "Atenção" : "Renovar em breve"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                {student.grade}
              </span>
              {student.school && (
                <span className="flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 shrink-0" />
                  {student.school}
                </span>
              )}
              {(student.user?.email || guardianUser?.email) && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {student.user?.email ?? guardianUser?.email}
                </span>
              )}
              {(student.user?.phone || guardianUser?.phone) && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {student.user?.phone ?? guardianUser?.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                Aluno desde {format(createdAt, "MMM/yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 shrink-0 items-start">
            <EditStudentDialog
              student={{
                id:     student.id,
                name:   student.name,
                grade:  student.grade,
                school: student.school,
                notes:  student.notes,
                tags:   student.tags,
                active: student.user?.active ?? true,
                user:   student.user
                  ? { email: student.user.email ?? null, phone: student.user.phone ?? null }
                  : null,
              }}
              guardian={guardian && guardianUser
                ? { user: { name: guardianUser.name, email: guardianUser.email ?? null, phone: guardianUser.phone ?? null } }
                : null}
            />
            <ScheduleLessonDialog
              studentId={id}
              studentName={student.name}
              teachers={teachersForDialog}
              hasBalance={!!activePkg && Number(activePkg.remainingLessons) > 0}
              otherStudents={allStudentsRaw}
            />
            {whatsappPhone && (
              <a
                href={`https://wa.me/55${whatsappPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5 text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10"}
              >
                <MessageCircle className="w-4 h-4" />
                {guardianPhone ? "Resp." : "Aluno"}
              </a>
            )}
            <button
              disabled
              className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5 opacity-50 cursor-not-allowed"}
              title="Em breve"
            >
              <CreditCard className="w-4 h-4" />
              Fatura
            </button>
          </div>
        </div>

        {/* Tags */}
        {student.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            {student.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Pacote atual */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Pacote atual</p>
          {activePkg ? (
            <>
              <p className="text-lg font-bold">
                <span className={Number(activePkg.remainingLessons) <= 2 ? "text-red-600" : "text-primary"}>
                  {fmtLessons(Number(activePkg.remainingLessons))}
                </span>
                <span className="text-muted-foreground font-normal text-sm"> / {fmtLessons(Number(activePkg.totalLessons))}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{fmtLessons(Number(activePkg.remainingLessons))} aulas restantes</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem pacote</p>
          )}
        </div>

        {/* Total de aulas */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total de aulas</p>
          <p className="text-lg font-bold">{totalDone + totalMissed}</p>
          <p className="text-[11px] text-muted-foreground">{totalDone} realizadas</p>
        </div>

        {/* Frequência */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Frequência</p>
          <p className={`text-lg font-bold ${frequency >= 90 ? "text-green-600" : frequency >= 70 ? "text-yellow-600" : "text-red-600"}`}>
            {frequency}%
          </p>
          <p className="text-[11px] text-muted-foreground">{totalMissed} falta{totalMissed !== 1 ? "s" : ""}</p>
        </div>

        {/* Total investido */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total investido</p>
          <p className="text-lg font-bold">{brl(totalInvested)}</p>
          <p className="text-[11px] text-muted-foreground">{student.payments.filter(p => p.status === "PAID").length} pacotes</p>
        </div>

        {/* Próxima aula */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Próxima aula</p>
          {nextLesson ? (
            <>
              <p className="text-sm font-semibold leading-tight">
                {format(nextLesson.scheduledAt, "dd/MM", { locale: ptBR })}
                {" · "}
                {format(nextLesson.scheduledAt, "HH:mm")}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{nextLesson.subject?.name ?? "–"}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem aula</p>
          )}
        </div>

        {/* LTV projetado */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">LTV projetado</p>
          <p className="text-lg font-bold">{brl(ltvProjected)}</p>
          <p className="text-[11px] text-muted-foreground">anualizado</p>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Coluna principal (col-span-2) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Package timeline */}
          {!activePkg && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 flex flex-col items-center gap-3 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum pacote ativo</p>
              <PackageDialog studentId={id} studentName={student.name} mode="novo" />
            </div>
          )}

          {activePkg && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-sub text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {packageCode ? `Pacote em curso · #${packageCode}` : "Pacote em curso"}
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Pago
                    </Badge>
                  </CardTitle>
                  <PackageDialog studentId={id} studentName={student.name} mode={Number(activePkg.remainingLessons) <= 4 ? "renovar" : "novo"} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Comprado em {format(activePkg.purchaseDate, "dd 'de' MMMM", { locale: ptBR })}
                  {" · "}{fmtLessons(Number(activePkg.totalLessons))} aulas
                  {activePkg.expiresAt
                    ? ` · vence ${format(activePkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}`
                    : " · sem validade"}
                </p>
              </CardHeader>
              <CardContent>
                {/* Bubbles */}
                {(() => {
                  const total      = Number(activePkg.totalLessons)
                  const remaining  = Number(activePkg.remainingLessons)
                  const usedUnits  = total - remaining
                  const fullBubbles = Math.floor(total)
                  const hasHalf    = total % 1 >= 0.5
                  const nextBubble = Math.floor(usedUnits) + 1
                  return (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: fullBubbles }, (_, i) => {
                        const lessonNum = i + 1
                        const used   = lessonNum <= Math.floor(usedUnits)
                        const isNext = !used && lessonNum === nextBubble
                        return (
                          <div
                            key={i}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all
                              ${used
                                ? "bg-primary text-white"
                                : isNext
                                ? "ring-2 ring-primary text-primary bg-primary/5"
                                : "border border-border text-muted-foreground bg-muted/20"}`}
                          >
                            {String(lessonNum).padStart(2, "0")}
                          </div>
                        )
                      })}
                      {hasHalf && (
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all
                            ${usedUnits >= fullBubbles + 0.5
                              ? "bg-primary text-white"
                              : usedUnits >= fullBubbles
                              ? "ring-2 ring-primary text-primary bg-primary/5"
                              : "border border-border text-muted-foreground bg-muted/20"}`}
                          title="Meia aula"
                        >
                          ½
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>Usadas <strong className="text-foreground">{fmtLessons(Number(activePkg.totalLessons) - Number(activePkg.remainingLessons))}</strong></span>
                  <span>Restantes <strong className={Number(activePkg.remainingLessons) <= 2 ? "text-red-600" : "text-foreground"}>{fmtLessons(Number(activePkg.remainingLessons))}</strong></span>
                  {Number(activePkg.remainingLessons) > 0 && totalDone > 0 && (
                    <span>
                      Ritmo <strong className="text-foreground">~{(totalDone / monthsActive).toFixed(1)}/mês</strong>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Package history */}
          {student.packages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Histórico de Pacotes
                  <span className="text-xs font-normal text-muted-foreground">
                    ({student.packages.length} pacote{student.packages.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...student.packages].reverse().map((pkg, revIdx) => {
                  const pkgNum  = student.packages.length - revIdx
                  const total   = Number(pkg.pricePerLesson) * Number(pkg.totalLessons)
                  const used    = Number(pkg.totalLessons) - Number(pkg.remainingLessons)
                  const STATUS  = {
                    ACTIVE:    { label: "Ativo",    cls: "bg-green-100 text-green-700 border-green-200" },
                    EXPIRED:   { label: "Expirado", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                    EXHAUSTED: { label: "Esgotado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
                  } as const
                  const st = STATUS[pkg.status]
                  return (
                    <div key={pkg.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                      <div className="shrink-0 text-xs font-bold text-muted-foreground w-10">
                        #{String(pkgNum).padStart(3, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(pkg.purchaseDate, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtLessons(Number(pkg.totalLessons))} aulas · {fmtLessons(used)} usadas · {brl(Number(pkg.pricePerLesson))}/aula · total {brl(total)}
                          {pkg.expiresAt && ` · vence ${format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                      <BatchPastLessonsDialog
                        studentId={id}
                        packageId={pkg.id}
                        studentName={student.name}
                        totalLessons={Number(pkg.totalLessons)}
                        remainingLessons={Number(pkg.remainingLessons)}
                        teachers={teachersForDialog}
                        otherStudents={allStudentsRaw}
                      />
                      <EditPackageDialog
                        studentId={id}
                        pkg={{
                          id:               pkg.id,
                          totalLessons:     Number(pkg.totalLessons),
                          pricePerLesson:   Number(pkg.pricePerLesson),
                          remainingLessons: Number(pkg.remainingLessons),
                          status:           pkg.status as "ACTIVE" | "EXHAUSTED" | "EXPIRED",
                          purchaseDate:     format(pkg.purchaseDate, "yyyy-MM-dd"),
                          expiresAt:        pkg.expiresAt ? format(pkg.expiresAt, "yyyy-MM-dd") : null,
                        }}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Lesson history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Histórico de Aulas
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {totalDone + totalMissed} no total · {totalDone} realizadas · {totalMissed} falta{totalMissed !== 1 ? "s" : ""}
                  </p>
                  <RegisterPastLessonDialog
                    studentId={id}
                    teachers={teachersForDialog}
                    allStudents={allStudentsRaw}
                    packages={activePackages}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Heatmap */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Frequência · últimas 13 semanas
                </p>
                <LessonHeatmap entries={heatmapEntries} />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 border-b border-border pb-3">
                {(["todas", "realizadas", "faltas"] as const).map(t => (
                  <Link
                    key={t}
                    href={`?tab=${t === "todas" ? "" : t}`}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                      (t === "todas" && !tab) || tab === t
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Link>
                ))}
              </div>

              {/* Table */}
              {filteredLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma aula encontrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium">Data & Hora</th>
                        <th className="text-left py-2 pr-3 font-medium">Matéria</th>
                        <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Professor</th>
                        <th className="text-left py-2 pr-3 font-medium hidden md:table-cell">Conteúdo</th>
                        <th className="text-left py-2 pr-3 font-medium">Avaliação</th>
                        <th className="text-left py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredLessons.map(l => (
                        <tr key={l.id} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 text-xs tabular-nums whitespace-nowrap">
                            {format(l.scheduledAt, "dd/MM · HH:mm", { locale: ptBR })}
                          </td>
                          <td className="py-2 pr-3 text-xs font-medium whitespace-nowrap">{l.subject?.name ?? "–"}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                            {l.teacher?.user.name.split(" ")[0] ?? "—"}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px]">
                            <span className="truncate block" title={l.topicsCovered ?? undefined}>
                              {l.topicsCovered ?? "—"}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <StarRating rating={l.studentRating} />
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${LESSON_STATUS[l.status as keyof typeof LESSON_STATUS]?.cls ?? ""}`}>
                                {LESSON_STATUS[l.status as keyof typeof LESSON_STATUS]?.label ?? l.status}
                              </span>
                              <EditLessonDialog
                                lesson={{
                                  id:            l.id,
                                  date:          format(l.scheduledAt, "yyyy-MM-dd"),
                                  time:          format(l.scheduledAt, "HH:mm"),
                                  status:        l.status,
                                  teacherId:     l.teacher?.id ?? "",
                                  subjectId:     l.subjectId ?? null,
                                  modality:      l.modality,
                                  duration:      l.duration,
                                  topicsCovered: l.topicsCovered,
                                  teacherNotes:  l.teacherNotes,
                                }}
                                studentId={id}
                                teachers={teachersForDialog}
                              />
                              {isAdmin && <DeleteLessonButton lessonId={l.id} />}
                              {!isAdmin && <RequestCancellationButton lessonId={l.id} />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <HistoryPagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                hrefForPage={(p) => {
                  const sp = new URLSearchParams()
                  if (tab) sp.set("tab", tab)
                  sp.set("page", String(p))
                  return `?${sp.toString()}`
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna lateral (col-span-1) ──────────────────────────────── */}
        <div className="space-y-4">

          {/* Financeiro */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="font-sub text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Financeiro
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {brl(totalInvested)} totais
                    {activePkg && (
                      <> · próx. {brl(Number(activePkg.pricePerLesson) * Number(activePkg.remainingLessons))}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ReceiptDialog
                    studentId={id}
                    payments={paymentsForReceipt}
                    guardianName={guardianUser?.name ?? null}
                    guardianPhone={guardianPhone ?? null}
                  />
                  <AddPaymentDialog studentId={id} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {student.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem pagamentos</p>
              ) : (
                student.payments.map(pay => (
                  <div key={pay.id} className="group flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium">{brl(Number(pay.amount))}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {format(pay.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                        {pay.installmentTotal && pay.installmentTotal > 1 &&
                          ` · Parcela ${pay.installmentNumber}/${pay.installmentTotal}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PaymentStatusSelector paymentId={pay.id} currentStatus={pay.status} />
                      <DeletePaymentButton paymentId={pay.id} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Professores */}
          {teachersList.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Professores
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {teachersList.length} ativo{teachersList.length !== 1 ? "s" : ""}
                  {teachersList[0] && <> · {teachersList[0].name.split(" ")[0]} é o principal</>}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {teachersList.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ${avatarColor(t.name)}`}>
                      {initials(t.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium truncate">{t.name}</p>
                        {i === 0 && (
                          <span className="text-[10px] px-1 py-0 rounded bg-primary/10 text-primary font-semibold shrink-0">principal</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t.count} aula{t.count !== 1 ? "s" : ""} · última {formatDistanceToNow(t.lastAt, { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Responsável */}
          {guardianUser && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-primary" />
                  Responsável
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-sm">{guardianUser.name}</p>
                {guardianUser.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <a href={`mailto:${guardianUser.email}`} className="hover:text-foreground truncate">
                      {guardianUser.email}
                    </a>
                  </div>
                )}
                {guardianUser.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {guardianUser.phone}
                  </div>
                )}
                {guardianPhone && (
                  <a
                    href={`https://wa.me/55${guardianPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full justify-center text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 gap-1.5 mt-1 text-xs h-8"}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Observações
                </CardTitle>
                <button
                  disabled
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 opacity-60 cursor-not-allowed"
                  title="Em breve"
                >
                  <Plus className="w-3 h-3" />
                  Nova
                </button>
              </div>
              {student.studentNotes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {student.studentNotes.length} nota{student.studentNotes.length !== 1 ? "s" : ""}
                  {" · última "}
                  {formatDistanceToNow(student.studentNotes[0].createdAt, { locale: ptBR, addSuffix: true })}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {student.studentNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma observação ainda</p>
              ) : (
                student.studentNotes.map(note => (
                  <div key={note.id} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{note.author.name.split(" ")[0]}</span>
                      <span className="text-muted-foreground text-[11px]">
                        {format(note.createdAt, "dd MMM", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{note.content}</p>
                  </div>
                ))
              )}
              {student.notes && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">Nota interna</p>
                  <p className="text-xs text-muted-foreground">{student.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
