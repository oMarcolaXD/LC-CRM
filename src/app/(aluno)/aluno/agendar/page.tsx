import { auth }              from "@/lib/auth"
import { prisma }            from "@/lib/prisma"
import { redirect }          from "next/navigation"
import { getActiveStudent }  from "@/lib/get-active-student"
import { PageHeader }        from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen }          from "lucide-react"
import { BookingForm }       from "./booking-form"

interface AgendarPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function AgendarPage({ searchParams }: AgendarPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { error } = await searchParams

  const { student: activeStudent } = await getActiveStudent(session.user.id)
  if (!activeStudent) redirect("/aluno/sem-aluno")

  const student = await prisma.student.findUnique({
    where:   { id: activeStudent.id },
    include: { packages: { where: { status: "ACTIVE", remainingLessons: { gt: 0 } } } },
  })

  const saldo = student?.packages.reduce((s, p) => s + p.remainingLessons, 0) ?? 0

  if (saldo === 0) {
    return (
      <div>
        <PageHeader title="AGENDAR AULA" backHref="/aluno/dashboard" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="font-sub font-semibold text-lg">Sem saldo de aulas</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Você não tem aulas disponíveis no momento. Entre em contato para adquirir um pacote.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [teachers, subjects] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: {
        user:     true,
        subjects: { include: { subject: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ])

  return (
    <div>
      <PageHeader
        title="AGENDAR AULA"
        description={`Você tem ${saldo} aula(s) disponível(is)`}
      />
      <Card>
        <CardContent className="pt-6">
          <BookingForm
            teachers={teachers.map((t) => ({
              id:          t.id,
              name:        t.user.name,
              avatar:      t.user.avatar ?? undefined,
              bio:         t.bio ?? undefined,
              teachingMode: t.teachingMode,
              subjects:    t.subjects.map((ts) => ({
                subjectId: ts.subjectId,
                levels:    ts.levels,
              })),
            }))}
            subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
            studentLevel={student?.educationLevel ?? null}
            studentId={activeStudent.id}
            error={error}
          />
        </CardContent>
      </Card>
    </div>
  )
}
