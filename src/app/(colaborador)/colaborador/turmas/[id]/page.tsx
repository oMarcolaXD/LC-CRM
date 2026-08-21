import Link           from "next/link"
import { notFound }    from "next/navigation"
import { prisma }      from "@/lib/prisma"
import { auth }        from "@/lib/auth"
import { PageHeader }  from "@/components/shared/page-header"
import { formatBR }    from "@/lib/datetime"
import { ptBR }        from "date-fns/locale"
import {
  CalendarClock, Wallet, Users2, GraduationCap, MapPin, Wifi,
} from "lucide-react"
import { descreverGrade, descreverPeriodo, COURSE_STATUS_LABELS } from "@/lib/course"
import { TurmaActions, RemoverAlunoButton } from "./_components/turma-actions"

export const dynamic = "force-dynamic"

const LESSON_STATUS = {
  SCHEDULED: { label: "Agendada",   cls: "bg-amber-100 text-amber-700"   },
  CONFIRMED: { label: "Confirmada", cls: "bg-sky-100 text-sky-700"       },
  COMPLETED: { label: "Realizada",  cls: "bg-slate-100 text-slate-600"   },
  CANCELLED: { label: "Cancelada",  cls: "bg-red-100 text-red-600"       },
  MISSED:    { label: "Faltou",     cls: "bg-orange-100 text-orange-700" },
} as const

const PAYMENT_STATUS = {
  PAID:    { label: "Pago",    cls: "bg-green-100 text-green-700"   },
  PENDING: { label: "Pendente", cls: "bg-amber-100 text-amber-700"  },
  OVERDUE: { label: "Vencido", cls: "bg-red-100 text-red-600"       },
} as const

interface Props {
  params: Promise<{ id: string }>
}

export default async function TurmaDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  const [turma, alunosDisponiveis] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        teacher:     { include: { user: { select: { name: true } } } },
        subject:     true,
        enrollments: {
          include: { student: { select: { id: true, ra: true, name: true, grade: true } } },
          orderBy: { enrolledAt: "asc" },
        },
        lessons: {
          orderBy: { scheduledAt: "asc" },
          select:  { id: true, scheduledAt: true, status: true, duration: true },
        },
        payments: {
          include: { student: { select: { id: true, name: true } } },
          orderBy: [{ dueDate: "asc" }],
        },
      },
    }),
    prisma.student.findMany({
      where:   { OR: [{ userId: null }, { user: { active: true } }] },
      select:  { id: true, name: true, ra: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!turma) notFound()

  const grade    = descreverGrade(turma.weekday, turma.startTime)
  const periodo  = descreverPeriodo(turma.startDate, turma.endDate)
  const situacao = COURSE_STATUS_LABELS[turma.status]
  const preco    = turma.pricePerStudent ? Number(turma.pricePerStudent) : 0

  const matriculados = new Set(turma.enrollments.map(e => e.studentId))
  const paraMatricular = alunosDisponiveis.filter(a => !matriculados.has(a.id))

  const realizadas = turma.lessons.filter(l => l.status === "COMPLETED").length
  const futuras    = turma.lessons.filter(l => ["SCHEDULED", "CONFIRMED"].includes(l.status)).length

  const recebido = turma.payments
    .filter(p => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0)
  const aReceber = turma.payments
    .filter(p => p.status !== "PAID")
    .reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader title={turma.name.toUpperCase()} backHref="/colaborador/turmas">
        <TurmaActions
          courseId={turma.id}
          status={turma.status}
          isAdmin={session?.user?.role === "ADMIN"}
          alunosDisponiveis={paraMatricular}
        />
      </PageHeader>

      {/* Cabeçalho */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${situacao.cls}`}>
            {situacao.label}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
            {turma.modality === "PRESENCIAL"
              ? <><MapPin className="w-3 h-3" /> Presencial</>
              : <><Wifi className="w-3 h-3" /> Online{turma.teacherOnsite && " (prof. na sede)"}</>}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Grade</p>
            <p className="font-medium flex items-center gap-1.5 mt-0.5">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {grade ?? "Sem grade fixa"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="font-medium mt-0.5">{periodo ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Professor</p>
            <p className="font-medium mt-0.5">
              {turma.teacher?.user.name ?? "—"}
              {turma.subject && <span className="text-muted-foreground"> · {turma.subject.name}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contrato</p>
            <p className="font-medium mt-0.5">
              {preco > 0
                ? <>R$ {preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por aluno{turma.installments > 1 && ` em ${turma.installments}x`}</>
                : "Sem cobrança"}
            </p>
          </div>
        </div>

        {turma.description && (
          <p className="text-sm text-muted-foreground pt-2 border-t border-border">{turma.description}</p>
        )}
      </div>

      {/* Números */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Alunos",           valor: String(turma.enrollments.length), icon: Users2        },
          { label: "Encontros dados",  valor: `${realizadas} de ${turma.lessons.length}`, icon: GraduationCap },
          { label: "Recebido",         valor: `R$ ${recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Wallet },
          { label: "A receber",        valor: `R$ ${aReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Wallet },
        ].map(({ label, valor, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </p>
            <p className="text-lg font-bold font-sub mt-1">{valor}</p>
          </div>
        ))}
      </div>

      {/* Alunos */}
      <section className="rounded-xl border border-border bg-card">
        <header className="px-5 py-3 border-b border-border">
          <h2 className="font-sub font-semibold text-sm">Alunos matriculados</h2>
        </header>
        {turma.enrollments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            Nenhum aluno matriculado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {turma.enrollments.map(({ student, enrolledAt }) => {
              const doAluno   = turma.payments.filter(p => p.studentId === student.id)
              const pendentes = doAluno.filter(p => p.status !== "PAID").length
              return (
                <li key={student.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/colaborador/alunos/${student.id}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {student.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{student.ra}</span>
                      {" · "}{student.grade}
                      {" · matriculado em "}{formatBR(enrolledAt, "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {doAluno.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {pendentes > 0
                          ? `${pendentes} parcela${pendentes !== 1 ? "s" : ""} em aberto`
                          : "Tudo pago"}
                      </span>
                    )}
                    {turma.status === "ACTIVE" && (
                      <RemoverAlunoButton
                        courseId={turma.id}
                        studentId={student.id}
                        studentName={student.name}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Encontros */}
      <section className="rounded-xl border border-border bg-card">
        <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <h2 className="font-sub font-semibold text-sm">
            Encontros
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {futuras} pela frente · {realizadas} realizado{realizadas !== 1 ? "s" : ""}
            </span>
          </h2>
        </header>
        {turma.lessons.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhum encontro na grade.</p>
        ) : (
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {turma.lessons.map(aula => {
              const st = LESSON_STATUS[aula.status]
              return (
                <li key={aula.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span>
                    {formatBR(aula.scheduledAt, "EEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    <span className="text-muted-foreground text-xs ml-2">{aula.duration} min</span>
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Cobranças */}
      {turma.payments.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="px-5 py-3 border-b border-border">
            <h2 className="font-sub font-semibold text-sm">Cobranças do contrato</h2>
          </header>
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {turma.payments.map(p => {
              const st = PAYMENT_STATUS[p.status]
              return (
                <li key={p.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    {p.student.name}
                    <span className="text-muted-foreground text-xs ml-2">
                      {p.installmentNumber && p.installmentTotal
                        ? `parcela ${p.installmentNumber}/${p.installmentTotal} · `
                        : ""}
                      vence {formatBR(p.dueDate, "dd/MM/yyyy")}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-medium tabular-nums">
                      R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
