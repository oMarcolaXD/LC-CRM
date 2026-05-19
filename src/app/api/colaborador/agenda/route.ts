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

const requestInclude = {
  student: { include: { user: true } },
  teacher: { include: { user: true } },
  subject: true,
} as const

type RawLesson  = Awaited<ReturnType<typeof prisma.lesson.findMany<{ include: typeof lessonInclude }>>>[number]
type RawRequest = Awaited<ReturnType<typeof prisma.lessonRequest.findMany<{ include: typeof requestInclude }>>>[number]

function mapLesson(l: RawLesson, groupMatesMap: Record<string, string[]> = {}) {
  const d           = l.scheduledAt
  const min         = d.getHours() * 60 + d.getMinutes()
  const studentName = l.student.user?.name ?? "Aluno"
  return {
    id:            l.id,
    teacherId:     l.teacherId,
    startMin:      min,
    duration:      l.duration ?? 60,
    status:        l.status,
    modality:      l.modality,
    teacherOnsite: l.teacherOnsite,
    time:          format(d, "HH:mm"),
    studentName,
    subjectName:   l.subject.name,
    guardianName:  l.student.guardian?.user.name ?? null,
    date:          format(d, "yyyy-MM-dd"),
    isGroupLesson: l.isGroupLesson,
    groupSize:     l.groupSize,
    groupId:       l.groupId,
    groupMates:    l.groupId
      ? (groupMatesMap[l.groupId] ?? []).filter(n => n !== studentName)
      : [],
  }
}

function mapPendingRequest(r: RawRequest) {
  const d   = r.preferredAt
  const min = d.getHours() * 60 + d.getMinutes()
  return {
    id:          r.id,
    teacherId:   r.teacherId,
    startMin:    min,
    time:        format(d, "HH:mm"),
    date:        format(d, "yyyy-MM-dd"),
    studentName: r.student.user?.name ?? "Aluno",
    subjectName: r.subject?.name ?? "–",
    modality:    r.modality,
    teacherMode: r.teacher.teachingMode,
    notes:       r.reason ?? null,
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

  // Intervalo para as views de semana/mês
  const weekStart = startOfDay(startOfWeek(dateObj, { weekStartsOn: 1 }))
  const weekEnd   = endOfDay(endOfWeek(dateObj,     { weekStartsOn: 1 }))
  const extStart  = view === "week"  ? weekStart
                  : view === "month" ? startOfDay(startOfWeek(startOfMonth(dateObj), { weekStartsOn: 1 }))
                  : dayStart
  const extEnd    = view === "week"  ? weekEnd
                  : view === "month" ? endOfDay(endOfWeek(endOfMonth(dateObj), { weekStartsOn: 1 }))
                  : dayEnd

  const [lessons, extraLessons, pendingRequests, weekPendingRequests] = await Promise.all([
    // Aulas do dia
    prisma.lesson.findMany({
      where:   { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: lessonInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    // Aulas da semana/mês (para views extras)
    view !== "day"
      ? prisma.lesson.findMany({
          where:   { scheduledAt: { gte: extStart, lte: extEnd } },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([] as RawLesson[]),
    // Solicitações pendentes do dia
    prisma.lessonRequest.findMany({
      where:   { status: "PENDING", preferredAt: { gte: dayStart, lte: dayEnd } },
      include: requestInclude,
      orderBy: { preferredAt: "asc" },
    }),
    // Solicitações pendentes da semana/mês
    view !== "day"
      ? prisma.lessonRequest.findMany({
          where:   { status: "PENDING", preferredAt: { gte: extStart, lte: extEnd } },
          include: requestInclude,
          orderBy: { preferredAt: "asc" },
        })
      : Promise.resolve([] as RawRequest[]),
  ])

  // Colegas de turma para aulas em grupo
  const allLessons = [...lessons, ...extraLessons]
  const groupIds = [...new Set(allLessons.filter(l => l.isGroupLesson && l.groupId).map(l => l.groupId!))]
  const groupSiblings = groupIds.length > 0
    ? await prisma.lesson.findMany({
        where:  { groupId: { in: groupIds } },
        select: { groupId: true, student: { select: { user: { select: { name: true } } } } },
      })
    : []
  const groupMatesMap = groupSiblings.reduce<Record<string, string[]>>((acc, l) => {
    if (!l.groupId) return acc
    ;(acc[l.groupId] ??= []).push(l.student.user?.name ?? "Aluno")
    return acc
  }, {})

  return NextResponse.json({
    lessons:             lessons.map(l => mapLesson(l, groupMatesMap)),
    extraLessons:        extraLessons.map(l => mapLesson(l, groupMatesMap)),
    pendingRequests:     pendingRequests.map(mapPendingRequest),
    weekPendingRequests: weekPendingRequests.map(mapPendingRequest),
  })
}
