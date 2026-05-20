import { type NextRequest } from "next/server"
import { prisma }           from "@/lib/prisma"
import { notifyLessonReminder } from "@/lib/notifications"
import { format }           from "date-fns"
import { ptBR }             from "date-fns/locale"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const fmt = (d: Date) => format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  // Janelas de busca
  const h24start = new Date(now.getTime() + 23 * 3600_000)
  const h24end   = new Date(now.getTime() + 25 * 3600_000)
  const h1start  = new Date(now.getTime() + 45 * 60_000)
  const h1end    = new Date(now.getTime() + 75 * 60_000)

  const [lessons24h, lessons1h] = await Promise.all([
    prisma.lesson.findMany({
      where: { status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { gte: h24start, lte: h24end } },
      include: { participants: { include: { student: { include: { user: true } } } }, teacher: { include: { user: true } }, subject: true },
    }),
    prisma.lesson.findMany({
      where: { status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { gte: h1start,  lte: h1end  } },
      include: { participants: { include: { student: { include: { user: true } } } }, teacher: { include: { user: true } }, subject: true },
    }),
  ])

  let sent = 0

  for (const [lessons, type] of [
    [lessons24h, "LESSON_REMINDER_24H"],
    [lessons1h,  "LESSON_REMINDER_1H" ],
  ] as const) {
    for (const lesson of lessons) {
      const scheduledAt = fmt(lesson.scheduledAt)
      const teacherName = lesson.teacher.user.name
      const subject     = lesson.subject.name

      for (const p of lesson.participants) {
        const studentName = p.student.user?.name ?? "Aluno"
        await Promise.allSettled([
          notifyLessonReminder({
            userId: p.student.userId ?? "", email: p.student.user?.email ?? null,
            phone: p.student.user?.phone ?? null, role: "student",
            teacherName, studentName, subject, scheduledAt, type,
          }),
          notifyLessonReminder({
            userId: lesson.teacher.userId, email: lesson.teacher.user.email,
            phone: lesson.teacher.user.phone, role: "teacher",
            teacherName, studentName, subject, scheduledAt, type,
          }),
        ])
        sent += 2
      }
    }
  }

  return Response.json({ ok: true, sent, "24h": lessons24h.length, "1h": lessons1h.length })
}
