import { NextRequest, NextResponse } from "next/server"
import { auth }    from "@/lib/auth"
import { prisma }  from "@/lib/prisma"
import {
  format, parseISO, isValid,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from "date-fns"

const lessonInclude = {
  student: {
    include: {
      user:     true,
      guardian: { include: { user: true } },
    },
  },
  subject: true,
} as const

type RawLesson = Awaited<ReturnType<typeof prisma.lesson.findMany<{
  include: typeof lessonInclude
}>>>[number]

function mapLesson(l: RawLesson) {
  const d   = l.scheduledAt
  const min = d.getHours() * 60 + d.getMinutes()
  return {
    id:            l.id,
    teacherId:     l.teacherId,
    startMin:      min,
    duration:      l.duration ?? 60,
    status:        l.status,
    modality:      l.modality,
    teacherOnsite: l.teacherOnsite,
    time:          format(d, "HH:mm"),
    studentName:   l.student.user.name,
    subjectName:   l.subject.name,
    guardianName:  l.student.guardian?.user.name ?? null,
    date:          format(d, "yyyy-MM-dd"),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const sp      = req.nextUrl.searchParams
  const rawDate = sp.get("date")
  const view    = sp.get("view") ?? "day"

  const parsed  = rawDate ? parseISO(rawDate) : new Date()
  const dateObj = isValid(parsed) ? parsed : new Date()

  const dayStart = startOfDay(dateObj)
  const dayEnd   = endOfDay(dateObj)

  const [lessons, extraLessons] = await Promise.all([
    prisma.lesson.findMany({
      where:   { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: lessonInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    view === "week"
      ? prisma.lesson.findMany({
          where: {
            scheduledAt: {
              gte: startOfDay(startOfWeek(dateObj, { weekStartsOn: 1 })),
              lte: endOfDay(endOfWeek(dateObj,     { weekStartsOn: 1 })),
            },
          },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : view === "month"
      ? prisma.lesson.findMany({
          where: {
            scheduledAt: {
              gte: startOfDay(startOfWeek(startOfMonth(dateObj), { weekStartsOn: 1 })),
              lte: endOfDay(endOfWeek(endOfMonth(dateObj),       { weekStartsOn: 1 })),
            },
          },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([] as RawLesson[]),
  ])

  return NextResponse.json({
    lessons:      lessons.map(mapLesson),
    extraLessons: extraLessons.map(mapLesson),
  })
}
