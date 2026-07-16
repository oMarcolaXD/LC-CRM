import { NextRequest, NextResponse } from "next/server"
import { auth }    from "@/lib/auth"
import { prisma }  from "@/lib/prisma"
import {
  parseISO, isValid,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from "date-fns"
import { formatBR, toBrazilDate } from "@/lib/datetime"

const lessonInclude = {
  participants: {
    include: {
      student: {
        include: {
          user:     true,
          guardian: { include: { user: true } },
        },
      },
    },
  },
  subject: true,
  teacher: { include: { user: true } },
} as const

const requestInclude = {
  student: { include: { user: true } },
  teacher: { include: { user: true } },
  subject: true,
} as const

type RawLesson  = Awaited<ReturnType<typeof prisma.lesson.findMany<{ include: typeof lessonInclude }>>>[number]
type RawRequest = Awaited<ReturnType<typeof prisma.lessonRequest.findMany<{ include: typeof requestInclude }>>>[number]

function mapLesson(l: RawLesson) {
  const d         = l.scheduledAt
  const brD       = toBrazilDate(d)
  const min       = brD.getHours() * 60 + brD.getMinutes()
  const first     = l.participants[0]
  const isGroup   = l.participants.length > 1 || l.lessonType === "GROUP"
  const lessonType = l.lessonType as string
  return {
    id:            l.id,
    teacherId:     l.teacherId,
    startMin:      min,
    duration:      l.duration ?? 60,
    status:        l.status,
    modality:      l.modality,
    teacherOnsite: l.teacherOnsite,
    time:          formatBR(d, "HH:mm"),
    studentName:   first?.student.name ?? (lessonType === "COMPROMISSO" ? "" : "Aluno"),
    subjectName:   l.subject?.name ?? "–",
    guardianName:  first?.student.guardian?.user.name ?? null,
    date:          formatBR(d, "yyyy-MM-dd"),
    isGroupLesson: isGroup,
    groupSize:     isGroup ? l.participants.length : null,
    groupMates:    l.participants.slice(1).map(p => p.student.name ?? "Aluno"),
    lessonType:    lessonType,
    title:         l.title ?? null,
    capacity:      l.capacity ?? null,
  }
}

function mapAulaoCard(l: RawLesson & { teacher: { user: { name: string } } }) {
  const d       = l.scheduledAt
  const endTime = new Date(d.getTime() + (l.duration ?? 90) * 60_000)
  return {
    id:          l.id,
    lessonType:  l.lessonType === "AULAO" ? "AULAO" : "GROUP",
    title:       l.title ?? l.subject?.name ?? "–",
    teacherName: l.teacher.user.name,
    teacherId:   l.teacherId,
    subjectName: l.subject?.name ?? "–",
    time:        formatBR(d,       "HH:mm"),
    endTime:     formatBR(endTime, "HH:mm"),
    enrolled:    l.participants.length,
    capacity:    l.capacity ?? null,
    status:      l.status,
    modality:    l.modality,
  }
}

function mapPendingRequest(r: RawRequest) {
  const d    = r.preferredAt
  const brD  = toBrazilDate(d)
  const min  = brD.getHours() * 60 + brD.getMinutes()
  return {
    id:          r.id,
    teacherId:   r.teacherId,
    startMin:    min,
    time:        formatBR(d, "HH:mm"),
    date:        formatBR(d, "yyyy-MM-dd"),
    studentName: r.student.name ?? "Aluno",
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

  const mappedLessons = lessons.map(mapLesson)
  const auloes = view === "day"
    ? lessons
        .filter(l => l.lessonType === "AULAO" || l.lessonType === "GROUP" || l.participants.length > 1)
        .map(l => mapAulaoCard(l as Parameters<typeof mapAulaoCard>[0]))
    : []

  return NextResponse.json({
    lessons:             mappedLessons,
    extraLessons:        extraLessons.map(mapLesson),
    pendingRequests:     pendingRequests.map(mapPendingRequest),
    weekPendingRequests: weekPendingRequests.map(mapPendingRequest),
    auloes,
  })
}
