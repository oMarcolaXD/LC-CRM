import { notFound }      from "next/navigation"
import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { formatBR }      from "@/lib/datetime"
import { PageHeader }    from "@/components/shared/page-header"
import { AulaoDetailClient } from "./_components/aulao-detail-client"
import type { AulaoDetail, ParticipantItem, StudentOption } from "./_components/aulao-detail-client"
import type { EditTeacherOption } from "@/components/shared/edit-aulao-dialog"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AulaoDetailPage({ params }: Props) {
  const { id } = await params

  const lesson = await prisma.lesson.findUnique({
    where:   { id },
    include: {
      teacher:          { include: { user: true } },
      subject:          true,
      recurrenceGroup:  true,
      participants: {
        include: {
          student: {
            include: {
              payments: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  })

  if (!lesson || !["AULAO", "GROUP"].includes(lesson.lessonType)) notFound()

  const [allStudentsRaw, teachersRaw, session, seriesPendingCount] = await Promise.all([
    prisma.student.findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: { user: true, subjects: { include: { subject: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    auth(),
    // Quantas ocorrências a edição "esta e as próximas" alcançaria — mesma
    // regra do servidor (ver updateAulaoAction): esta + as futuras pendentes.
    lesson.recurrenceGroupId
      ? prisma.lesson.count({
          where: {
            recurrenceGroupId: lesson.recurrenceGroupId,
            status:            { in: ["SCHEDULED", "CONFIRMED"] },
            OR: [{ id: lesson.id }, { scheduledAt: { gte: new Date() } }],
          },
        })
      : Promise.resolve(0),
  ])

  const teachers: EditTeacherOption[] = teachersRaw.map(t => ({
    id:           t.id,
    name:         t.user.name,
    teachingMode: t.teachingMode as EditTeacherOption["teachingMode"],
    subjects:     t.subjects.map(s => ({ id: s.subject.id, name: s.subject.name })),
  }))

  const price = lesson.priceOverride ? lesson.priceOverride.toNumber() : 0

  const participants: ParticipantItem[] = lesson.participants.map(p => {
    // Busca o pagamento mais recente vinculado à data deste aulão
    const payment = p.student.payments.find(
      pay => pay.dueDate.getTime() === lesson.scheduledAt.getTime()
    ) ?? p.student.payments[0] ?? null

    return {
      studentId:     p.studentId,
      studentName:   p.student.name,
      paymentStatus: (payment?.status ?? null) as ParticipantItem["paymentStatus"],
    }
  })

  const aulao: AulaoDetail = {
    id:                lesson.id,
    lessonType:        lesson.lessonType as "AULAO" | "GROUP",
    title:             lesson.title,
    teacherId:         lesson.teacherId,
    teacherName:       lesson.teacher.user.name,
    subjectId:         lesson.subjectId,
    subjectName:       lesson.subject?.name ?? "–",
    scheduledAt:       lesson.scheduledAt.toISOString(),
    date:              formatBR(lesson.scheduledAt, "yyyy-MM-dd"),
    time:              formatBR(lesson.scheduledAt, "HH:mm"),
    duration:          lesson.duration ?? 90,
    modality:          lesson.modality as "PRESENCIAL" | "ONLINE",
    teacherOnsite:     lesson.teacherOnsite,
    status:            lesson.status,
    capacity:          lesson.capacity,
    isFree:            price === 0,
    pricePerStudent:   price > 0 ? price : null,
    participants,
    recurrenceGroupId: lesson.recurrenceGroupId ?? null,
    recurrenceRule:    lesson.recurrenceGroup?.rule ?? null,
    seriesPendingCount,
  }

  const allStudents: StudentOption[] = allStudentsRaw.map(s => ({ id: s.id, name: s.name }))

  const title = lesson.title ?? lesson.subject?.name ?? "Aulão"

  return (
    <div>
      <PageHeader
        title={title}
        description={`${lesson.lessonType === "AULAO" ? "Aulão" : "Aula em grupo"} · ${lesson.teacher.user.name}`}
        backHref="/colaborador/auloes"
      />
      <AulaoDetailClient
        aulao={aulao}
        allStudents={allStudents}
        teachers={teachers}
        canDelete={session?.user?.role === "ADMIN"}
      />
    </div>
  )
}
