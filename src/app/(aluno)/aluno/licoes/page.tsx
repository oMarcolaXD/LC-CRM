import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { redirect }         from "next/navigation"
import { getActiveStudent } from "@/lib/get-active-student"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }             from "@/components/ui/badge"
import { CompleteHomeworkButton } from "./complete-homework-button"
import { PenLine, CheckCircle2, Clock, BookOpen, User } from "lucide-react"
import { format } from "date-fns"
import { ptBR }   from "date-fns/locale"

export default async function LicoesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { student } = await getActiveStudent(session.user.id)
  if (!student) redirect("/aluno/sem-aluno")

  const homework = await prisma.homework.findMany({
        where:   { lesson: { participants: { some: { studentId: student.id } } } },
        include: {
          lesson: {
            include: {
              subject: true,
              teacher: { include: { user: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      })

  const pending   = homework.filter((h) => h.status === "PENDING")
  const completed = homework.filter((h) => h.status === "COMPLETED")

  return (
    <div className="space-y-6">
      <PageHeader title="LIÇÕES DE CASA" />

      {/* Pendentes */}
      <section className="space-y-3">
        <h2 className="font-sub font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" /> Pendentes ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              Nenhuma lição pendente. Tudo em dia!
            </CardContent>
          </Card>
        ) : (
          pending.map((h, i) => (
            <Card key={h.id} className="card-lift animate-fade-up"
              style={{ "--delay": `${i * 50}ms` } as React.CSSProperties}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="bg-orange-50 p-2 rounded-lg shrink-0">
                    <PenLine className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-snug">{h.title}</p>
                    {h.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" /> {h.lesson.subject.name}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {h.lesson.teacher.user.name}
                      </span>
                      {h.dueDate && (
                        <Badge variant="secondary" className="text-xs text-orange-600 bg-orange-50">
                          Prazo: {format(h.dueDate, "dd/MM", { locale: ptBR })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <CompleteHomeworkButton homeworkId={h.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Concluídas */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-sub font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Concluídas ({completed.length})
          </h2>
          {completed.map((h) => (
            <Card key={h.id} className="opacity-70">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-green-50 p-2 rounded-lg shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm line-through text-muted-foreground">{h.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{h.lesson.subject.name}</span>
                    {h.completedAt && (
                      <span className="text-xs text-muted-foreground">
                        Concluída em {format(h.completedAt, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {homework.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            <PenLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma lição de casa atribuída ainda.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
