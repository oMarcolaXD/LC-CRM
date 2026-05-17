import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { RequestCard } from "@/components/shared/request-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import { ClipboardList, CheckCircle2, UserRound } from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"

export default async function AgendamentosPage() {
  const [pending, recent] = await Promise.all([
    prisma.lessonRequest.findMany({
      where:   { status: "PENDING" },
      include: {
        student: { include: { user: true, guardian: { include: { user: true } } } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.lessonRequest.findMany({
      where:   { status: { in: ["APPROVED", "REJECTED"] } },
      include: {
        student: { include: { user: true, guardian: { include: { user: true } } } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "desc" },
      take:    20,
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="AGENDAMENTOS"
        description="Gerencie as solicitações de aulas"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Solicitações Pendentes
            {pending.length > 0 && (
              <Badge variant="destructive">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <RequestCard
                  key={r.id}
                  id={r.id}
                  studentName={r.student.user.name}
                  teacherName={r.teacher.user.name}
                  subjectName={r.subject?.name ?? "–"}
                  preferredAt={r.preferredAt}
                  notes={r.reason}
                  teacherMode={r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"}
                  requestModality={r.modality as "PRESENCIAL" | "ONLINE"}
                  isGroupRequest={r.isGroupRequest}
                  groupNote={r.groupNote}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base">Processados Recentemente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{r.student.user.name}</p>
                  {r.student.guardian && (
                    <div className="flex items-center gap-1">
                      <UserRound className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Resp.: {r.student.guardian.user.name}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {r.subject?.name ?? "–"} · {format(r.preferredAt, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <Badge variant={r.status === "APPROVED" ? "default" : "destructive"}>
                  {r.status === "APPROVED" ? "Aprovada" : "Recusada"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
