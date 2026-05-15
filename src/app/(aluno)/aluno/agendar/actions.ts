"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { lessonRequestSchema } from "@/lib/validations/lesson"
import { revalidatePath }      from "next/cache"
import { redirect }            from "next/navigation"
import { notifyLessonRequest } from "@/lib/notifications"
import { isWithinAvailability, hasConflict } from "@/lib/availability"
import type { Availability }   from "@/lib/availability"
import { format }              from "date-fns"
import { ptBR }                from "date-fns/locale"

export async function requestLessonAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const raw    = Object.fromEntries(formData)
  const parsed = lessonRequestSchema.safeParse(raw)
  if (!parsed.success) {
    redirect(`/aluno/agendar?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`)
  }

  const now = new Date()

  const student = await prisma.student.findFirst({
    where:   { user: { email: session.user.email ?? "" } },
    include: {
      user:     true,
      // Filtra pacotes ativos E não expirados
      packages: {
        where: {
          status:           "ACTIVE",
          remainingLessons: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    },
  })

  if (!student)                      redirect("/aluno/agendar?error=Perfil+de+aluno+não+encontrado")
  if (student.packages.length === 0) redirect("/aluno/agendar?error=Você+não+tem+aulas+disponíveis.+Adquira+um+pacote.")

  const { teacherId, subjectId, preferredAt, modality, notes } = parsed.data
  const requestDate = new Date(preferredAt)

  // Busca professor com disponibilidade e aulas já marcadas
  const teacher = await prisma.teacher.findUnique({
    where:   { id: teacherId },
    include: {
      user:    true,
      lessons: {
        where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
        select: { scheduledAt: true },
      },
    },
  })

  if (!teacher) redirect("/aluno/agendar?error=Professor+não+encontrado")

  // Valida disponibilidade e conflito de horário no backend
  const availability = (teacher.availability ?? {}) as Availability
  if (!isWithinAvailability(requestDate, availability)) {
    redirect("/aluno/agendar?error=Horário+fora+da+disponibilidade+do+professor")
  }
  if (hasConflict(requestDate, teacher.lessons.map((l) => l.scheduledAt))) {
    redirect("/aluno/agendar?error=Horário+já+está+ocupado")
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })

  await prisma.lessonRequest.create({
    data: {
      studentId:   student.id,
      teacherId,
      subjectId,
      preferredAt: requestDate,
      status:      "PENDING",
      reason:      notes,
    },
  })

  await notifyLessonRequest({
    teacherId:    teacher.id,
    teacherEmail: teacher.user.email,
    teacherPhone: teacher.user.phone,
    studentName:  student.user.name,
    subject:      subject?.name ?? "–",
    preferredAt:  format(requestDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
  })

  revalidatePath("/aluno/aulas")
  redirect("/aluno/aulas?success=Solicitação+enviada!+Aguarde+a+confirmação+do+professor.")
}
