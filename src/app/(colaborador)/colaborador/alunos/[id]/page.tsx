import { prisma }        from "@/lib/prisma"
import { notFound }      from "next/navigation"
import { PageHeader }    from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }         from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  GraduationCap, UserRound, Phone, Mail, CalendarDays,
  BookOpen, MessageCircle, AlertCircle, School, FileText,
  CreditCard, Clock,
} from "lucide-react"
import { format, differenceInYears } from "date-fns"
import { ptBR } from "date-fns/locale"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const PAYMENT_CFG = {
  PENDING: { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  PAID:    { label: "Pago",      cls: "bg-green-100  text-green-700  border-green-200"  },
  OVERDUE: { label: "Vencido",   cls: "bg-red-100    text-red-700    border-red-200"    },
}

const LESSON_STATUS_CFG = {
  SCHEDULED:  { label: "Agendada",   cls: "bg-blue-100   text-blue-700   border-blue-200"   },
  CONFIRMED:  { label: "Confirmada", cls: "bg-green-100  text-green-700  border-green-200"  },
  COMPLETED:  { label: "Concluída",  cls: "bg-gray-100   text-gray-700   border-gray-200"   },
  CANCELLED:  { label: "Cancelada",  cls: "bg-red-100    text-red-700    border-red-200"    },
  MISSED:     { label: "Faltou",     cls: "bg-orange-100 text-orange-700 border-orange-200" },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params

  const [student, studentLessons] = await Promise.all([
    prisma.student.findUnique({
      where:   { id },
      include: {
        user: true,
        guardian: { include: { user: true } },
        packages: { orderBy: { purchaseDate: "desc" }, take: 5 },
        payments:  { orderBy: { dueDate: "desc" },    take: 5 },
      },
    }),
    prisma.lesson.findMany({
      where:   { participants: { some: { studentId: id } } },
      include: { subject: true, teacher: { include: { user: true } } },
      orderBy: { scheduledAt: "desc" },
      take:    10,
    }),
  ])

  if (!student) notFound()

  const phone        = student.user?.phone?.replace(/\D/g, "")
  const guardian     = student.guardian
  const guardianPhone = guardian?.user.phone?.replace(/\D/g, "")
  const activePkg    = student.packages.find((p) => p.status === "ACTIVE")
  const remaining    = activePkg?.remainingLessons ?? 0
  const upcomingLessons = studentLessons.filter(
    (l) => l.scheduledAt >= new Date() && ["SCHEDULED", "CONFIRMED"].includes(l.status)
  )
  const pastLessons = studentLessons.filter(
    (l) => l.scheduledAt < new Date() || ["COMPLETED", "CANCELLED", "MISSED"].includes(l.status)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.user?.name ?? "Aluno"}
        description={`${student.grade}${student.school ? ` · ${student.school}` : ""}`}
        backHref="/colaborador/alunos"
      >
        <div className="flex gap-2">
          {phone && (
            <a
              href={`https://wa.me/55${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" }) +
                " text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 gap-1.5"}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Aluno
            </a>
          )}
          {guardianPhone && (
            <a
              href={`https://wa.me/55${guardianPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" }) +
                " text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 gap-1.5"}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Resp.
            </a>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna esquerda — dados + pacote */}
        <div className="space-y-6 lg:col-span-1">

          {/* Dados do aluno */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                Dados do Aluno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {student.user?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${student.user?.email}`} className="hover:text-foreground transition-colors truncate">
                    {student.user?.email}
                  </a>
                </div>
              )}
              {student.user?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{student.user?.phone}</span>
                </div>
              )}
              {student.school && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <School className="w-4 h-4 shrink-0" />
                  <span>{student.school}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>{student.grade}</span>
              </div>
              {student.notes && (
                <div className="flex items-start gap-2 text-muted-foreground pt-1 border-t border-border">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{student.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Responsável */}
          {guardian && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-primary" />
                  Responsável
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium">{guardian.user.name}</p>
                {guardian.user.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${guardian.user.email}`} className="hover:text-foreground transition-colors truncate">
                      {guardian.user.email}
                    </a>
                  </div>
                )}
                {guardian.user.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{guardian.user.phone}</span>
                  </div>
                )}
                {guardianPhone && (
                  <a
                    href={`https://wa.me/55${guardianPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" }) +
                      " w-full justify-center text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 gap-1.5 mt-1"}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Abrir WhatsApp
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pacote ativo */}
          <Card className={remaining <= 2 ? "border-red-200" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <BookOpen className={`w-4 h-4 ${remaining <= 2 ? "text-red-500" : "text-primary"}`} />
                Pacote de Aulas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {activePkg ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Saldo restante</span>
                    <span className={`font-semibold ${remaining <= 2 ? "text-red-600" : "text-green-600"}`}>
                      {remaining} aula{remaining !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total do pacote</span>
                    <span>{activePkg.totalLessons} aulas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor/aula</span>
                    <span>{brl(Number(activePkg.pricePerLesson))}</span>
                  </div>
                  {activePkg.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Validade</span>
                      <span>{format(activePkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                  {remaining <= 2 && (
                    <p className="text-xs text-red-600 flex items-center gap-1 pt-1 border-t border-red-100">
                      <AlertCircle className="w-3 h-3" />
                      Saldo baixo — renovar pacote
                    </p>
                  )}
                </>
              ) : (
                <p className="text-destructive text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Sem pacote ativo
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita — aulas + pagamentos */}
        <div className="space-y-6 lg:col-span-2">

          {/* Próximas aulas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Próximas Aulas
                {upcomingLessons.length > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 ml-auto">
                    {upcomingLessons.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula agendada</p>
              ) : (
                <div className="space-y-2">
                  {upcomingLessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{lesson.subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {lesson.teacher && ` · ${lesson.teacher.user.name}`}
                        </p>
                      </div>
                      <Badge className={`${LESSON_STATUS_CFG[lesson.status].cls} hover:${LESSON_STATUS_CFG[lesson.status].cls} text-xs shrink-0`}>
                        {LESSON_STATUS_CFG[lesson.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de aulas */}
          {pastLessons.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Histórico de Aulas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastLessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{lesson.subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {lesson.teacher && ` · ${lesson.teacher.user.name}`}
                        </p>
                      </div>
                      <Badge className={`${LESSON_STATUS_CFG[lesson.status].cls} hover:${LESSON_STATUS_CFG[lesson.status].cls} text-xs shrink-0`}>
                        {LESSON_STATUS_CFG[lesson.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagamentos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Pagamentos Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento registrado</p>
              ) : (
                <div className="space-y-2">
                  {student.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{brl(Number(payment.amount))}</p>
                        <p className="text-xs text-muted-foreground">
                          Venc.: {format(payment.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                          {payment.paidAt && ` · Pago em ${format(payment.paidAt, "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                      <Badge className={`${PAYMENT_CFG[payment.status].cls} hover:${PAYMENT_CFG[payment.status].cls} text-xs shrink-0`}>
                        {PAYMENT_CFG[payment.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
