"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { lessonRequestSchema } from "@/lib/validations/lesson"
import { revalidatePath }      from "next/cache"
import { redirect }            from "next/navigation"
import { notifyLessonRequest } from "@/lib/notifications"
import { isWithinAvailability, hasConflict } from "@/lib/availability"
import type { Availability }   from "@/lib/availability"
import { getBookingPolicy }    from "@/lib/config"
import { format, addWeeks }    from "date-fns"
import { ptBR }                from "date-fns/locale"
import { randomUUID }          from "crypto"
import { parseBrazilDateTime } from "@/lib/datetime"

export async function requestLessonAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const raw = Object.fromEntries(formData)
  // Responsáveis não agendam aulas em grupo/dupla — isso é feito apenas pelo
  // colaborador. Forçamos individual mesmo que o payload traga o contrário.
  const parsed = lessonRequestSchema.safeParse({
    ...raw,
    isGroupRequest: false,
  })
  if (!parsed.success) {
    redirect(`/aluno/agendar?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`)
  }

  const now = new Date()

  const rawStudentId = String(Object.fromEntries(formData).studentId ?? "")
  const guardian = await prisma.guardian.findFirst({
    where: { userId: session.user.id },
    include: { students: { select: { id: true } } },
  })
  if (!guardian) redirect("/aluno/agendar?error=Responsável+não+encontrado")

  const owns = guardian.students.some((s) => s.id === rawStudentId)
  if (!owns) redirect("/aluno/agendar?error=Aluno+não+vinculado+a+este+responsável")

  const student = await prisma.student.findUnique({
    where:   { id: rawStudentId },
    include: {
      user:     true,
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

  const { teacherId, subjectId, preferredAt, modality, notes, isGroupRequest, groupNote } = parsed.data
  // `preferredAt` chega como "YYYY-MM-DDTHH:mm:00" (sem fuso). Interpretamos
  // sempre como horário de Brasília — senão o servidor UTC (Vercel) grava 3h a
  // mais. Ver src/lib/datetime.ts.
  const [datePart, timePart] = preferredAt.split("T")
  const requestDate = parseBrazilDateTime(datePart, (timePart ?? "").slice(0, 5))
  if (isNaN(requestDate.getTime())) {
    redirect(`/aluno/agendar?error=${encodeURIComponent("Data ou horário inválidos")}`)
  }

  // Valida limites de agendamento definidos pelo admin
  const policy = await getBookingPolicy()

  if (policy.minHoursAhead > 0) {
    const minMs = policy.minHoursAhead * 60 * 60 * 1000
    if (requestDate.getTime() - now.getTime() < minMs) {
      redirect(`/aluno/agendar?error=${encodeURIComponent(`É necessário agendar com pelo menos ${policy.minHoursAhead}h de antecedência`)}`)
    }
  }

  const horizon = new Date(now)
  horizon.setHours(23, 59, 59, 999)
  horizon.setDate(horizon.getDate() + policy.maxDaysAhead)
  if (requestDate.getTime() > horizon.getTime()) {
    redirect(`/aluno/agendar?error=${encodeURIComponent(`Só é possível agendar até ${policy.maxDaysAhead} dias à frente`)}`)
  }

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
  if (!teacher.externalBooking) {
    redirect("/aluno/agendar?error=Professor+não+disponível+para+agendamento")
  }

  // Valida disponibilidade e conflito de horário no backend
  const availability = (teacher.availability ?? {}) as unknown as Availability
  if (!isWithinAvailability(requestDate, availability)) {
    redirect("/aluno/agendar?error=Horário+fora+da+disponibilidade+do+professor")
  }
  if (hasConflict(requestDate, teacher.lessons.map((l) => l.scheduledAt))) {
    redirect("/aluno/agendar?error=Horário+já+está+ocupado")
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })

  // ── Agendamento recorrente (semanal, mesmo dia e horário) ───────────────────
  const recurring   = String(raw.recurring ?? "") === "true"
  const occurrences = Math.min(Math.max(2, parseInt(String(raw.occurrences ?? "1"), 10) || 1), 12)

  if (recurring && occurrences > 1) {
    // Aulas de 60min → custo 1 cada. Cria só o que couber no saldo total.
    const totalRemaining = student.packages.reduce((sum, p) => sum + Number(p.remainingLessons), 0)
    const maxByBalance   = Math.max(1, Math.floor(totalRemaining))
    const target         = Math.min(occurrences, maxByBalance)

    // Gera ocorrências semanais e pula as que conflitam com aulas já marcadas
    const booked = teacher.lessons.map((l) => l.scheduledAt)
    const toCreate: Date[] = []
    for (let i = 0; i < target; i++) {
      const d = addWeeks(requestDate, i)
      if (!hasConflict(d, booked)) toCreate.push(d)
    }

    if (toCreate.length === 0) {
      redirect("/aluno/agendar?error=Horários+da+série+indisponíveis")
    }

    const seriesId = randomUUID()
    const total    = toCreate.length

    await prisma.lessonRequest.createMany({
      data: toCreate.map((d, i) => ({
        studentId:          student.id,
        teacherId,
        subjectId,
        preferredAt:        d,
        modality,
        status:             "PENDING" as const,
        reason:             notes,
        isGroupRequest:     false,
        recurrenceSeriesId: seriesId,
        seriesIndex:        i + 1,
        seriesTotal:        total,
      })),
    })

    // Notifica o professor por ocorrência (uma notificação por aula da série)
    for (const d of toCreate) {
      try {
        await notifyLessonRequest({
          teacherId:    teacher.user.id,
          teacherEmail: teacher.user.email ?? "",
          teacherPhone: teacher.user.phone,
          studentName:  student.name ?? "Aluno",
          subject:      subject?.name ?? "–",
          preferredAt:  format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        })
      } catch {
        // Notificação falha silenciosamente — os pedidos já foram criados
      }
    }

    revalidatePath("/aluno/aulas")
    redirect("/aluno/agendar/sucesso")
  }

  await prisma.lessonRequest.create({
    data: {
      studentId:     student.id,
      teacherId,
      subjectId,
      preferredAt:   requestDate,
      modality,
      status:        "PENDING",
      reason:        notes,
      isGroupRequest: isGroupRequest ?? false,
      groupNote:     groupNote,
    },
  })

  try {
    await notifyLessonRequest({
      teacherId:    teacher.user.id,
      teacherEmail: teacher.user.email ?? "",
      teacherPhone: teacher.user.phone,
      studentName:  student.name ?? "Aluno",
      subject:      subject?.name ?? "–",
      preferredAt:  format(requestDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    })
  } catch {
    // Notificação falha silenciosamente — o agendamento já foi criado
  }

  revalidatePath("/aluno/aulas")
  redirect("/aluno/agendar/sucesso")
}
