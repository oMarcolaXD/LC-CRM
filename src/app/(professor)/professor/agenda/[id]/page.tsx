import { notFound }     from "next/navigation"
import { prisma }       from "@/lib/prisma"
import { auth }         from "@/lib/auth"
import { PageHeader }   from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }        from "@/components/ui/badge"
import { LessonStatusButtons } from "./lesson-status-buttons"
import { AddHomeworkForm }     from "./add-homework-form"
import { format }       from "date-fns"
import { ptBR }         from "date-fns/locale"
import { CalendarDays, User, BookOpen, Monitor, MapPin, PenLine, CheckCircle2, Clock, CalendarPlus, Users } from "lucide-react"

function buildGoogleCalendarUrl(lesson: {
  scheduledAt: Date
  duration:    number
  subject:     { name: string }
  student:     { user: { name: string } | null }
  modality:    string
  meetingLink: string | null
  location:    string | null
}): string {
  const start   = lesson.scheduledAt
  const end     = new Date(start.getTime() + lesson.duration * 60_000)
  const fmt     = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  const title   = `Aula de ${lesson.subject.name} com ${lesson.student.user?.name ?? "Aluno"}`
  const loc     = lesson.modality === "ONLINE"
    ? (lesson.meetingLink ?? "Online")
    : (lesson.location   ?? "Presencial")
  const details = `Matéria: ${lesson.subject.name}\nAluno: ${lesson.student.user?.name ?? "Aluno"}\nModalidade: ${lesson.modality === "ONLINE" ? "Online" : "Presencial"}`

  const p = new URLSearchParams({
    action:  "TEMPLATE",
    text:    title,
    dates:   `${fmt(start)}/${fmt(end)}`,
    details,
    location: loc,
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

interface LessonDetailProps {
  params: Promise<{ id: string }>
}

export default async function LessonDetailPage({ params }: LessonDetailProps) {
  const { id } = await params
  await auth()

  const lesson = await prisma.lesson.findUnique({
    where:   { id },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      subject: true,
      homework: true,
    },
  })
  if (!lesson) notFound()

  // Busca outros alunos do grupo (se for aula em grupo)
  const groupMates = lesson.isGroupLesson && lesson.groupId
    ? await prisma.lesson.findMany({
        where:  { groupId: lesson.groupId, studentId: { not: lesson.studentId } },
        select: { student: { select: { user: { select: { name: true } } } } },
      })
    : []

  const isCompleted = ["COMPLETED", "CANCELLED", "MISSED"].includes(lesson.status)
  const gcUrl       = buildGoogleCalendarUrl(lesson)

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="DETALHES DA AULA" backHref="/professor/agenda" />

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { icon: User,        label: "Aluno",       value: lesson.student.user?.name ?? "Aluno" },
              { icon: BookOpen,    label: "Matéria",     value: lesson.subject.name       },
              { icon: CalendarDays,label: "Data/Hora",   value: format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
              { icon: lesson.modality === "ONLINE" ? Monitor : MapPin, label: "Modalidade", value: lesson.modality === "ONLINE" ? "Online" : "Presencial" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Seção de alunos do grupo */}
          {lesson.isGroupLesson && (
            <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Aula em grupo ({lesson.groupSize ?? groupMates.length + 1} aluno{(lesson.groupSize ?? groupMates.length + 1) !== 1 ? "s" : ""})
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {lesson.student.user?.name ?? "Aluno"}
                  </span>
                  {groupMates.map((gm, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {gm.student.user?.name ?? "Aluno"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isCompleted && (
            <a
              href={gcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:opacity-80 transition-opacity"
            >
              <CalendarPlus className="w-4 h-4" />
              Adicionar ao Google Agenda
            </a>
          )}
        </CardContent>
      </Card>

      {/* Registrar conteúdo / Alterar status */}
      {!isCompleted ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base">Registrar Aula</CardTitle>
          </CardHeader>
          <CardContent>
            <LessonStatusButtons lessonId={lesson.id} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base flex items-center gap-2">
                Registro
                <Badge variant={lesson.status === "COMPLETED" ? "default" : "destructive"}>
                  {lesson.status === "COMPLETED" ? "Realizada" : lesson.status === "CANCELLED" ? "Cancelada" : "Faltou"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lesson.topicsCovered && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Conteúdo ensinado</p>
                  <p className="bg-muted/50 rounded-lg p-3">{lesson.topicsCovered}</p>
                </div>
              )}
              {lesson.teacherNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações do professor</p>
                  <p className="bg-muted/50 rounded-lg p-3">{lesson.teacherNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lições de Casa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" /> Lições de Casa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lesson.homework.length > 0 && (
                <ul className="space-y-2">
                  {lesson.homework.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 text-sm">
                      {h.status === "COMPLETED"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        : <Clock className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />}
                      <div>
                        <p className={h.status === "COMPLETED" ? "line-through text-muted-foreground" : "font-medium"}>{h.title}</p>
                        {h.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Prazo: {format(h.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className={lesson.homework.length > 0 ? "border-t pt-4" : ""}>
                <p className="text-xs text-muted-foreground mb-3">Atribuir nova lição</p>
                <AddHomeworkForm lessonId={lesson.id} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
