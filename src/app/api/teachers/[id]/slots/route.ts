import { NextRequest, NextResponse } from "next/server"
import { prisma }                    from "@/lib/prisma"
import { auth }                      from "@/lib/auth"
import { getAvailableSlotsForDate, getAvailableDates } from "@/lib/availability"
import type { Availability }         from "@/lib/availability"
import { getBookingPolicy }          from "@/lib/config"
import { parseBrazilDateTime }       from "@/lib/datetime"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id }      = await params
  const { searchParams } = req.nextUrl
  const dateStr     = searchParams.get("date") // YYYY-MM-DD

  const teacher = await prisma.teacher.findUnique({ where: { id } })
  if (!teacher) return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })

  // Professor não habilitado para agendamento externo não expõe horários.
  if (!teacher.externalBooking) {
    return NextResponse.json(dateStr ? { slots: [] } : { dates: [] })
  }

  const availability = (teacher.availability ?? {}) as unknown as Availability
  const policy       = await getBookingPolicy()
  const now          = new Date()

  // Se pediram slots de uma data específica
  if (dateStr) {
    // Janela em tempo absoluto no fuso de Brasília, com folga para trás: uma
    // aula longa do fim da noite anterior ainda pode invadir a manhã seguinte.
    const dayStart = parseBrazilDateTime(dateStr, "00:00").getTime()
    const bookedLessons = await prisma.lesson.findMany({
      where: {
        teacherId:   id,
        status:      { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: {
          gte: new Date(dayStart - 8 * 60 * 60_000),
          lt:  new Date(dayStart + 24 * 60 * 60_000),
        },
      },
      select: { scheduledAt: true, duration: true },
    })

    let slots = getAvailableSlotsForDate(dateStr, availability, bookedLessons)

    // Remove horários que violam a antecedência mínima definida pelo admin
    if (policy.minHoursAhead > 0) {
      const minMs = policy.minHoursAhead * 60 * 60 * 1000
      slots = slots.filter((hhmm) =>
        parseBrazilDateTime(dateStr, hhmm).getTime() - now.getTime() >= minMs
      )
    }

    return NextResponse.json({ slots })
  }

  // Retorna datas disponíveis dentro do horizonte definido pelo admin
  const availableDates = getAvailableDates(availability, policy.maxDaysAhead, policy.minHoursAhead)
  return NextResponse.json({
    dates: availableDates.map((d) => d.toISOString().slice(0, 10)),
  })
}
