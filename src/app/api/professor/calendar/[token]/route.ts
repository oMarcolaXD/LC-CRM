import { NextRequest, NextResponse } from "next/server"
import { prisma }               from "@/lib/prisma"
import { verifyCalendarToken }  from "@/lib/calendar-token"

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const teacherId  = verifyCalendarToken(token)
  if (!teacherId) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }

  const lessons = await prisma.lesson.findMany({
    where:   { teacherId, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    include: { participants: { include: { student: { include: { user: true } } } }, subject: true },
    orderBy: { scheduledAt: "asc" },
  })

  const now = new Date()

  const vevents = lessons.map((l) => {
    const firstStudentName = l.participants[0]?.student.user?.name ?? "Aluno"
    const end   = new Date(l.scheduledAt.getTime() + l.duration * 60_000)
    const title = `Aula de ${l.subject.name} com ${firstStudentName}`
    const loc   = l.modality === "ONLINE"
      ? (l.meetingLink ?? "Online")
      : (l.location    ?? "Presencial")
    const desc  = `Matéria: ${l.subject.name}\\nAluno: ${firstStudentName}\\nModalidade: ${l.modality === "ONLINE" ? "Online" : "Presencial"}`

    return [
      "BEGIN:VEVENT",
      `UID:lesson-${l.id}@licaodecasa.com.br`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(l.scheduledAt)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${escapeIcs(loc)}`,
      `STATUS:${l.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    ].join("\r\n")
  })

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LC CRM//Lição de Casa//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Minha Agenda — Lição de Casa",
    "X-WR-CALDESC:Aulas agendadas na plataforma Lição de Casa",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n")

  return new NextResponse(ics, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agenda-licaodecasa.ics"',
      "Cache-Control":       "no-cache, no-store, must-revalidate",
    },
  })
}
