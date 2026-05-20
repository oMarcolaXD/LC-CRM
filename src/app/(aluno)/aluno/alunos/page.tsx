import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { redirect }         from "next/navigation"
import { getActiveStudent } from "@/lib/get-active-student"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }             from "@/components/ui/badge"
import { LinkButton }        from "@/components/shared/link-button"
import {
  GraduationCap, BookOpen, CalendarDays, Wallet, School,
  CheckCircle2, Clock,
} from "lucide-react"

const EDUCATION_LABEL: Record<string, string> = {
  EF2:        "Fund. 2",
  EM:         "Ensino Médio",
  SUPERIOR:   "Superior",
  VESTIBULAR: "Vestibular / ENEM",
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

export default async function MeusAlunosPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { student: activeStudent, allStudents } = await getActiveStudent(session.user.id)
  if (!allStudents.length) redirect("/aluno/sem-aluno")

  // Busca dados de cada aluno em paralelo
  const studentIds = allStudents.map((s) => s.id)
  const now = new Date()

  const [lessonsCompleted, lessonsUpcoming, pendingPayments, activePackages] =
    await Promise.all([
      prisma.lesson.groupBy({
        by:    ["studentId"],
        where: { studentId: { in: studentIds }, status: "COMPLETED" },
        _count: { _all: true },
      }),
      prisma.lesson.groupBy({
        by:    ["studentId"],
        where: {
          studentId:   { in: studentIds },
          status:      { in: ["SCHEDULED", "CONFIRMED"] },
          scheduledAt: { gte: now },
        },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by:    ["studentId"],
        where: { studentId: { in: studentIds }, status: "PENDING" },
        _count: { _all: true },
      }),
      prisma.lessonPackage.groupBy({
        by:    ["studentId"],
        where: { studentId: { in: studentIds }, status: "ACTIVE" },
        _sum:  { remainingLessons: true },
      }),
    ])

  const statsMap = Object.fromEntries(
    studentIds.map((id) => [
      id,
      {
        completed:       lessonsCompleted.find((r) => r.studentId === id)?._count._all ?? 0,
        upcoming:        lessonsUpcoming.find((r) => r.studentId === id)?._count._all ?? 0,
        pendingPayments: pendingPayments.find((r) => r.studentId === id)?._count._all ?? 0,
        saldo:           activePackages.find((r) => r.studentId === id)?._sum.remainingLessons ?? 0,
      },
    ])
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading text-foreground">Meus Alunos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {allStudents.length === 1
            ? "1 aluno vinculado à sua conta"
            : `${allStudents.length} alunos vinculados à sua conta`}
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allStudents.map((s) => {
          const stats     = statsMap[s.id]
          const isActive  = s.id === activeStudent?.id

          return (
            <Card
              key={s.id}
              className={`relative transition-shadow hover:shadow-md ${
                isActive ? "ring-2 ring-primary/40 border-primary/30" : ""
              }`}
            >
              {isActive && (
                <span className="absolute top-3 right-3">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
                    Ativo
                  </Badge>
                </span>
              )}

              <CardContent className="pt-5 pb-4 space-y-4">

                {/* Avatar + info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">{initials(s.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-sub font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.grade}</p>
                    {s.educationLevel && (
                      <p className="text-xs text-muted-foreground">
                        {EDUCATION_LABEL[s.educationLevel] ?? s.educationLevel}
                      </p>
                    )}
                    {s.school && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <School className="w-3 h-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">{s.school}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{stats.saldo}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">aulas no saldo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{stats.upcoming}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">próximas aulas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{stats.completed}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">aulas feitas</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${
                    stats.pendingPayments > 0 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/50"
                  }`}>
                    <Wallet className={`w-3.5 h-3.5 shrink-0 ${stats.pendingPayments > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-xs font-semibold">{stats.pendingPayments}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">pag. pendente</p>
                    </div>
                  </div>
                </div>

                {/* Ação */}
                <LinkButton
                  href="/aluno/dashboard"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="w-full"
                >
                  {isActive ? "Ver Dashboard" : "Selecionar"}
                </LinkButton>

              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
