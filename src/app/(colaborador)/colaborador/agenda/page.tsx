import { prisma }             from "@/lib/prisma"
import { PageHeader }         from "@/components/shared/page-header"
import { DayStarterBanner }   from "@/components/shared/day-starter-banner"
import type { ConfirmacaoItem } from "@/components/shared/day-starter-banner"
import { AgendaGrid }         from "./agenda-grid"
import { AgendaLegend }       from "./agenda-legend"
import type {
  TeacherCol, LessonSlot, AulaoCard, AvailSlot, StudentOption,
  WeekLessonSlot, ViewMode, PendingRequestSlot,
} from "./agenda-grid"

import { getRoomCount }  from "@/lib/config"
import type { Availability } from "@/lib/availability"
import {
  format, startOfDay, endOfDay, parseISO, isValid, getDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMinutes,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { formatBR, toBrazilDate, nowBrazil } from "@/lib/datetime"

interface AgendaPageProps {
  searchParams: Promise<{ date?: string; view?: string }>
}

function parseAvailSlots(availability: unknown, dow: number): AvailSlot[] {
  if (!availability || typeof availability !== "object") return []
  const avail    = availability as Availability
  const daySlots = avail[String(dow)] ?? []
  return daySlots.map(s => {
    const [sh, sm] = s.start.split(":").map(Number)
    const [eh, em] = s.end.split(":").map(Number)
    return { start: sh * 60 + sm, end: eh * 60 + em }
  })
}

function mapToLessonSlot(
  l: {
    id: string
    teacherId: string
    scheduledAt: Date
    duration: number | null
    status: string
    modality: string
    teacherOnsite: boolean
    lessonType: string
    title: string | null
    capacity: number | null
    participants: {
      studentId: string
      student: {
        name: string
        user: { name: string } | null
        guardian: { user: { name: string } } | null
        packages: { remainingLessons: number | { toNumber(): number } }[]
      }
    }[]
    subject: { name: string } | null
  },
): LessonSlot {
  const d          = l.scheduledAt
  const br         = toBrazilDate(d)
  const min        = br.getHours() * 60 + br.getMinutes()
  const first      = l.participants[0]
  const lessonType = l.lessonType as LessonSlot["lessonType"]
  const isSpecial  = lessonType === "AULAO" || lessonType === "COMPROMISSO"
  const studentName = first?.student.name ?? (isSpecial ? "" : "Aluno")
  const isGroup     = l.participants.length > 1 || lessonType === "GROUP"
  const pkg         = first?.student.packages?.[0]
  const packageStatus: LessonSlot["packageStatus"] =
    isSpecial                  ? "pago"     :
    !pkg                       ? "pendente" :
    Number(pkg.remainingLessons) > 0   ? "pago"     : "atrasado"
  return {
    id:            l.id,
    teacherId:     l.teacherId,
    studentId:     first?.studentId ?? "",
    startMin:      min,
    duration:      l.duration ?? 60,
    status:        l.status as LessonSlot["status"],
    modality:      l.modality as LessonSlot["modality"],
    teacherOnsite: l.teacherOnsite,
    time:          formatBR(d, "HH:mm"),
    studentName,
    subjectName:   l.subject?.name ?? "–",
    guardianName:  first?.student.guardian?.user.name ?? null,
    isGroupLesson: isGroup,
    groupSize:     isGroup ? l.participants.length : null,
    groupMates:    l.participants.slice(1).map(p => p.student.name ?? "Aluno"),
    packageStatus,
    lessonType,
    title:         l.title ?? null,
    capacity:      l.capacity ?? null,
  }
}

export default async function ColaboradorAgendaPage({ searchParams }: AgendaPageProps) {
  const { date: rawDate, view: rawView } = await searchParams

  const parsed   = rawDate ? parseISO(rawDate) : nowBrazil()
  const dateObj  = isValid(parsed) ? parsed : nowBrazil()
  const dateStr  = format(dateObj, "yyyy-MM-dd")
  const dayStart = startOfDay(dateObj)
  const dayEnd   = endOfDay(dateObj)
  const dow      = getDay(dateObj)
  const viewMode: ViewMode =
    rawView === "week"  ? "week"  :
    rawView === "month" ? "month" : "day"

  const lessonInclude = {
    participants: {
      include: {
        student: {
          include: {
            user:     true,
            guardian: { include: { user: true } },
            packages: {
              where:   { status: "ACTIVE" },
              orderBy: { purchaseDate: "desc" },
              take:    1,
            },
          },
        },
      },
    },
    teacher: { include: { user: true } },
    subject: true,
  } as const

  const [teachers, lessons, roomCount, studentsRaw, pendingRaw, allStudentsRaw] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: {
        user:     true,
        subjects: { include: { subject: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.lesson.findMany({
      where:   { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: lessonInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    getRoomCount(),
    prisma.student.findMany({
      include: {
        packages: {
          where:   { status: "ACTIVE" },
          orderBy: { purchaseDate: "desc" },
          take:    1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lessonRequest.findMany({
      where: { status: "PENDING", preferredAt: { gte: dayStart, lte: endOfDay(dateObj) } },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { preferredAt: "asc" },
    }),
    // Todos os alunos (para o diálogo de aula em grupo)
    prisma.student.findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const pendingInclude = {
    student: { include: { user: true } },
    teacher: { include: { user: true } },
    subject: true,
  } as const

  // Fetch semana inteira apenas quando necessário
  const weekStart = startOfDay(startOfWeek(dateObj, { weekStartsOn: 1 }))
  const weekEnd   = endOfDay(endOfWeek(dateObj,     { weekStartsOn: 1 }))
  const monthCalStart = startOfDay(startOfWeek(startOfMonth(dateObj), { weekStartsOn: 1 }))
  const monthCalEnd   = endOfDay(endOfWeek(endOfMonth(dateObj),       { weekStartsOn: 1 }))

  const [weekLessonsRaw, monthLessonsRaw, extPendingRaw] = await Promise.all([
    viewMode === "week"
      ? prisma.lesson.findMany({
          where: { scheduledAt: { gte: weekStart, lte: weekEnd } },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    viewMode === "month"
      ? prisma.lesson.findMany({
          where: { scheduledAt: { gte: monthCalStart, lte: monthCalEnd } },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    viewMode === "week"
      ? prisma.lessonRequest.findMany({
          where: { status: "PENDING", preferredAt: { gte: weekStart, lte: weekEnd } },
          include: pendingInclude,
          orderBy: { preferredAt: "asc" },
        })
      : viewMode === "month"
      ? prisma.lessonRequest.findMany({
          where: { status: "PENDING", preferredAt: { gte: monthCalStart, lte: monthCalEnd } },
          include: pendingInclude,
          orderBy: { preferredAt: "asc" },
        })
      : Promise.resolve([]),
  ])

  const teacherCols: TeacherCol[] = teachers.map(t => ({
    id:              t.id,
    name:            t.user.name,
    teachingMode:    t.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
    slots:           parseAvailSlots(t.availability, dow),
    rawAvailability: (t.availability ?? {}) as Record<string, { start: string; end: string }[]>,
    subjects:        t.subjects.map(ts => ({ id: ts.subject.id, name: ts.subject.name })),
  }))

  const lessonSlots: LessonSlot[]  = lessons.map(l => mapToLessonSlot(l))
  const scheduledCount             = lessonSlots.filter(l => l.status === "SCHEDULED").length

  const aulaoCards: AulaoCard[] = lessons
    .filter(l =>
      l.lessonType === "AULAO" ||
      l.lessonType === "GROUP" ||
      l.participants.length > 1
    )
    .map(l => {
      const endDt = addMinutes(l.scheduledAt, l.duration ?? 90)
      return {
        id:          l.id,
        lessonType:  (l.lessonType === "AULAO" ? "AULAO" : "GROUP") as "AULAO" | "GROUP",
        title:       l.title ?? l.subject?.name ?? "–",
        teacherName: l.teacher.user.name,
        teacherId:   l.teacherId,
        subjectName: l.subject?.name ?? "–",
        time:        formatBR(l.scheduledAt, "HH:mm"),
        endTime:     formatBR(endDt,        "HH:mm"),
        enrolled:          l.participants.length,
        capacity:          l.capacity ?? null,
        status:            l.status,
        modality:          l.modality as "PRESENCIAL" | "ONLINE",
        recurrenceGroupId: l.recurrenceGroupId ?? null,
      }
    })

  // ── Itens para o modal de confirmações ────────────────────────────────────
  const scheduledLessons = lessons.filter(l => l.status === "SCHEDULED")

  const confirmacaoItems: ConfirmacaoItem[] = (() => {
    const items: ConfirmacaoItem[] = []

    // 1. Responsáveis (uma linha por aula)
    for (const lesson of scheduledLessons) {
      const first    = lesson.participants[0]
      if (!first) continue
      const student  = first.student
      const guardian = student.guardian
      const time     = formatBR(lesson.scheduledAt, "HH:mm")
      const modality = lesson.modality === "ONLINE" ? "online" : "sede"
      const studentFirst  = student.name.split(" ")[0]
      const guardianName  = guardian?.user.name ?? student.name ?? "Responsável"
      const guardianFirst = guardianName.split(" ")[0]
      const teacherFirst  = lesson.teacher.user.name.split(" ")[0]
      const pkg      = student.packages[0]
      const isOverdue = !pkg || Number(pkg.remainingLessons) <= 0
      const phone    = guardian?.user.phone ?? student.user?.phone ?? null
      const email    = guardian?.user.email ?? student.user?.email ?? null

      items.push({
        key:           `responsavel-${lesson.id}`,
        lessonId:      lesson.id,
        tipo:          "responsavel",
        recipientName: guardianName,
        recipientRole: `resp. de ${studentFirst}`,
        recipientPhone: phone,
        recipientEmail: email,
        aula:          `hoje ${time} · ${lesson.subject?.name ?? "–"} · ${modality}`,
        via:           phone ? "WhatsApp" : "E-mail",
        preview:       `Boa tarde, ${guardianFirst}! 💜 Confirmando a aula do(a) ${studentFirst} hoje às ${time} com ${teacherFirst} (${modality}).`,
      })

      // 3. Pacote vencido
      if (isOverdue) {
        items.push({
          key:           `pacote-${lesson.id}`,
          lessonId:      lesson.id,
          tipo:          "pacote",
          recipientName: guardianName,
          recipientRole: `pacote · ${studentFirst}`,
          recipientPhone: phone,
          recipientEmail: email,
          aula:          `hoje ${time} · ${studentFirst} · ${lesson.subject?.name ?? "–"}`,
          via:           phone ? "WhatsApp" : "E-mail",
          preview:       `${guardianFirst}, o pacote do(a) ${studentFirst} está vencido. Pode regularizar antes da aula de hoje (${time})?`,
        })
      }
    }

    // 2. Professores (agrupados por teacher)
    const teacherMap = new Map<string, typeof scheduledLessons>()
    for (const l of scheduledLessons) {
      teacherMap.set(l.teacherId, [...(teacherMap.get(l.teacherId) ?? []), l])
    }
    for (const [, tLessons] of teacherMap) {
      const teacher      = tLessons[0].teacher
      const teacherFirst = teacher.user.name.split(" ")[0]
      const count        = tLessons.length
      const aulaList     = tLessons
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
        .map(l => {
          const t = formatBR(l.scheduledAt, "HH:mm")
          const s = (l.participants[0]?.student.name ?? "aluno").split(" ")[0]
          return `${t} ${s}`
        })
        .join(" · ")

      items.push({
        key:           `professor-${teacher.id}`,
        lessonId:      tLessons[0].id,
        tipo:          "professor",
        recipientName: teacher.user.name,
        recipientRole: tLessons[0].subject?.name ?? "–",
        recipientPhone: teacher.user.phone ?? null,
        recipientEmail: teacher.user.email ?? null,
        aula:          aulaList,
        via:           teacher.user.phone ? "WhatsApp" : "E-mail",
        preview:       `Bom dia, ${teacherFirst}! Hoje você tem ${count} aula${count > 1 ? "s" : ""} agendada${count > 1 ? "s" : ""}. Confirma presença?`,
      })
    }

    return items
  })()

  const weekLessons: WeekLessonSlot[] = weekLessonsRaw.map(l => ({
    ...mapToLessonSlot(l),
    date: formatBR(l.scheduledAt, "yyyy-MM-dd"),
  }))

  const monthLessons: WeekLessonSlot[] = monthLessonsRaw.map(l => ({
    ...mapToLessonSlot(l),
    date: formatBR(l.scheduledAt, "yyyy-MM-dd"),
  }))

  function mapPending(r: typeof pendingRaw[0]): PendingRequestSlot {
    return {
      id:          r.id,
      teacherId:   r.teacherId,
      startMin:    toBrazilDate(r.preferredAt).getHours() * 60 + toBrazilDate(r.preferredAt).getMinutes(),
      time:        formatBR(r.preferredAt, "HH:mm"),
      date:        formatBR(r.preferredAt, "yyyy-MM-dd"),
      studentName: r.student.name ?? "Aluno",
      subjectName: r.subject?.name ?? "–",
      modality:    r.modality as "PRESENCIAL" | "ONLINE",
      teacherMode: r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
      notes:       r.reason ?? null,
    }
  }

  const pendingRequests:     PendingRequestSlot[] = pendingRaw.map(mapPending)
  const weekPendingRequests: PendingRequestSlot[] = extPendingRaw.map(mapPending)

  const students: StudentOption[] = studentsRaw.map(s => ({
    id:               s.id,
    name:             s.name,
    remainingLessons: Number(s.packages[0]?.remainingLessons ?? 0),
  }))

  const allStudents = allStudentsRaw.map(s => ({ id: s.id, name: s.name }))

  const weekday = format(dateObj, "EEEE", { locale: ptBR })

  return (
    <div className="space-y-4">
      <PageHeader
        title="AGENDA"
        description={`${weekday.charAt(0).toUpperCase() + weekday.slice(1)} · ${format(dateObj, "dd/MM/yyyy")}`}
      />
      <DayStarterBanner
        scheduledCount={scheduledCount}
        confirmacaoItems={confirmacaoItems}
        dateLabel={`${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${format(dateObj, "dd 'de' MMMM", { locale: ptBR })}`}
      />
      <AgendaGrid
        date={dateStr}
        teachers={teacherCols}
        lessons={lessonSlots}
        auloes={aulaoCards}
        roomCount={roomCount}
        students={students}
        allStudents={allStudents}
        weekLessons={weekLessons}
        monthLessons={monthLessons}
        initialView={viewMode}
        pendingRequests={pendingRequests}
        weekPendingRequests={weekPendingRequests}
        scheduledCount={scheduledCount}
      />
      <AgendaLegend />
    </div>
  )
}
