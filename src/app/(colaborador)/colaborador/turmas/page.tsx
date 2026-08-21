import Link              from "next/link"
import { prisma }         from "@/lib/prisma"
import type { Prisma }    from "@prisma/client"
import { PageHeader }     from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Plus, Users2, CalendarClock, GraduationCap, Wallet } from "lucide-react"
import { descreverGrade, descreverPeriodo, COURSE_STATUS_LABELS } from "@/lib/course"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function TurmasPage({ searchParams }: Props) {
  const { status = "ativas" } = await searchParams

  const where: Prisma.CourseWhereInput | undefined =
    status === "encerradas" ? { status: { in: ["FINISHED", "CANCELLED"] } }
    : status === "todas"    ? undefined
    :                         { status: "ACTIVE" }

  const [turmas, totalAtivas, totalEncerradas] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        teacher:     { include: { user: { select: { name: true } } } },
        subject:     { select: { name: true } },
        enrollments: { include: { student: { select: { id: true, ra: true, name: true } } } },
        _count:      { select: { lessons: true } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.course.count({ where: { status: "ACTIVE" } }),
    prisma.course.count({ where: { status: { in: ["FINISHED", "CANCELLED"] } } }),
  ])

  const TABS = [
    { key: "ativas",      label: "Em andamento", count: totalAtivas               },
    { key: "encerradas",  label: "Encerradas",   count: totalEncerradas           },
    { key: "todas",       label: "Todas",        count: totalAtivas + totalEncerradas },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader
        title="TURMAS"
        description="Acompanhamentos por período — grade fixa e contrato fechado"
      >
        <Link href="/colaborador/turmas/nova" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova turma
        </Link>
      </PageHeader>

      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(tab => (
          <a
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              status === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              status === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </a>
        ))}
      </div>

      {turmas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Users2 className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-medium">Nenhuma turma {status === "encerradas" ? "encerrada" : "em andamento"}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Turma é para o aluno que contrata um período inteiro em vez de comprar pacote de aulas —
            como um acompanhamento semestral de sábado.
          </p>
          <Link href="/colaborador/turmas/nova" className={buttonVariants({ variant: "outline" }) + " mt-4"}>
            <Plus className="w-4 h-4 mr-2" />
            Criar a primeira turma
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {turmas.map(turma => {
            const grade    = descreverGrade(turma.weekday, turma.startTime)
            const periodo  = descreverPeriodo(turma.startDate, turma.endDate)
            const situacao = COURSE_STATUS_LABELS[turma.status]
            const preco    = turma.pricePerStudent ? Number(turma.pricePerStudent) : 0

            return (
              <Link
                key={turma.id}
                href={`/colaborador/turmas/${turma.id}`}
                className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug">{turma.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {turma.subject?.name ?? "Sem matéria"}
                      {turma.teacher && ` · ${turma.teacher.user.name}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${situacao.cls}`}>
                    {situacao.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {grade && (
                    <p className="flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      {grade}
                    </p>
                  )}
                  {periodo && (
                    <p className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      {periodo} · {turma._count.lessons} encontro{turma._count.lessons !== 1 ? "s" : ""}
                    </p>
                  )}
                  {preco > 0 && (
                    <p className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 shrink-0" />
                      R$ {preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por aluno
                      {turma.installments > 1 && ` em ${turma.installments}x`}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  {turma.enrollments.length === 0 ? (
                    <span className="text-xs text-muted-foreground pt-2">Sem alunos matriculados</span>
                  ) : (
                    turma.enrollments.map(({ student }) => (
                      <span
                        key={student.id}
                        className="text-[11px] px-2 py-0.5 mt-2 rounded-full bg-muted text-muted-foreground"
                        title={`R.A. ${student.ra}`}
                      >
                        {student.name.split(" ")[0]}
                      </span>
                    ))
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
