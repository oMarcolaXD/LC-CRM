import { auth }              from "@/lib/auth"
import { prisma }            from "@/lib/prisma"
import { redirect }          from "next/navigation"
import { getActiveStudent }  from "@/lib/get-active-student"
import { PageHeader }     from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }          from "@/components/ui/badge"
import { LinkButton }     from "@/components/shared/link-button"
import { HistoryPagination } from "@/components/shared/history-pagination"
import { CalendarDays, Clock, MapPin, Monitor, Star, BookOpen, Users } from "lucide-react"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

const PER_PAGE = 15

const STATUS_CONFIG = {
  SCHEDULED:  { label: "Agendada",   variant: "secondary"   as const, color: "text-blue-600"   },
  CONFIRMED:  { label: "Confirmada", variant: "default"     as const, color: "text-green-600"  },
  COMPLETED:  { label: "Realizada",  variant: "outline"     as const, color: "text-gray-600"   },
  CANCELLED:  { label: "Cancelada",  variant: "destructive" as const, color: "text-red-600"    },
  MISSED:     { label: "Faltou",     variant: "destructive" as const, color: "text-orange-600" },
}

const REQUEST_CONFIG = {
  PENDING:    { label: "Aguardando",  variant: "secondary"   as const },
  APPROVED:   { label: "Aprovada",    variant: "default"     as const },
  REJECTED:   { label: "Recusada",    variant: "destructive" as const },
}

interface AulasPageProps {
  searchParams: Promise<{ success?: string; page?: string }>
}

export default async function AulasPage({ searchParams }: AulasPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { success, page: pageParam } = await searchParams

  const { student } = await getActiveStudent(session.user.id)
  if (!student) redirect("/aluno/sem-aluno")

  const page = Math.max(1, Number(pageParam) || 1)

  const [lessons, totalLessons, requests] = await Promise.all([
    prisma.lesson.findMany({
      where:   { participants: { some: { studentId: student.id } } },
      include: {
        teacher:      { include: { user: true } },
        subject:      true,
        participants: { include: { student: { include: { user: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      skip:    (page - 1) * PER_PAGE,
      take:    PER_PAGE,
    }),
    prisma.lesson.count({
      where: { participants: { some: { studentId: student.id } } },
    }),
    prisma.lessonRequest.findMany({
      where:   { studentId: student.id, status: "PENDING" },
      include: { teacher: { include: { user: true } }, subject: true },
      orderBy: { requestedAt: "desc" },
    }),
  ])

  const totalPages = Math.ceil(totalLessons / PER_PAGE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="MINHAS AULAS" />
        <LinkButton href="/aluno/agendar">
          <CalendarDays className="w-4 h-4 mr-2" /> Agendar Aula
        </LinkButton>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(success)}
        </div>
      )}

      {/* Solicitações pendentes */}
      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Solicitações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.subject?.name ?? "Matéria não informada"}</p>
                  <p className="text-xs text-muted-foreground">
                    Prof. {r.teacher.user.name} · {format(r.preferredAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge variant={REQUEST_CONFIG[r.status].variant}>
                  {REQUEST_CONFIG[r.status].label}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de aulas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Histórico de Aulas
            </CardTitle>
            {totalLessons > 0 && (
              <p className="text-xs text-muted-foreground">
                {totalLessons} aula{totalLessons !== 1 ? "s" : ""}
                {totalPages > 1 && ` · página ${page} de ${totalPages}`}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CalendarDays className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma aula encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => {
                const cfg      = STATUS_CONFIG[lesson.status]
                const isGroup  = lesson.participants.length > 1
                const mates    = lesson.participants
                  .filter(p => p.studentId !== student.id)
                  .map(p => p.student.name ?? "Aluno")
                return (
                  <div key={lesson.id} className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                    {/* Data */}
                    <div className="shrink-0 w-14 text-center">
                      <p className="text-xl font-bold font-sub text-primary leading-none">
                        {format(lesson.scheduledAt, "dd")}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(lesson.scheduledAt, "MMM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(lesson.scheduledAt, "HH:mm")}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{lesson.subject?.name ?? "–"}</p>
                        <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                        {isGroup && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                            <Users className="w-2.5 h-2.5" /> Grupo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prof. {lesson.teacher.user.name}
                      </p>
                      {isGroup && mates.length > 0 && (
                        <p className="text-xs text-primary/70 mt-0.5">
                          Com: {mates.join(", ")}
                        </p>
                      )}
                      {lesson.topicsCovered && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          📚 {lesson.topicsCovered}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {lesson.modality === "ONLINE"
                            ? <><Monitor className="w-3 h-3" /> Online</>
                            : <><MapPin className="w-3 h-3" /> Presencial</>
                          }
                        </span>
                        {isGroup && lesson.priceOverride && (
                          <span className="text-xs text-muted-foreground">
                            R$ {Number(lesson.priceOverride).toFixed(2).replace(".", ",")} (grupo)
                          </span>
                        )}
                        {lesson.studentRating && (
                          <span className="flex items-center gap-1 text-xs text-yellow-500">
                            <Star className="w-3 h-3 fill-yellow-500" /> {lesson.studentRating}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <HistoryPagination
            currentPage={page}
            totalPages={totalPages}
            hrefForPage={(p) => `?page=${p}`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
