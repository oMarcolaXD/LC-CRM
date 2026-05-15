import { NextRequest, NextResponse } from "next/server"
import { prisma }                    from "@/lib/prisma"
import { auth }                      from "@/lib/auth"
import { getAvailableSlotsForDate, getAvailableDates } from "@/lib/availability"
import type { Availability }         from "@/lib/availability"

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

  const availability = (teacher.availability ?? {}) as unknown as Availability

  // Se pediram slots de uma data específica
  if (dateStr) {
    const date = new Date(dateStr + "T00:00:00")

    const bookedLessons = await prisma.lesson.findMany({
      where: {
        teacherId:   id,
        status:      { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: {
          gte: new Date(dateStr + "T00:00:00"),
          lte: new Date(dateStr + "T23:59:59"),
        },
      },
      select: { scheduledAt: true },
    })

    const slots = getAvailableSlotsForDate(
      date,
      availability,
      bookedLessons.map((l) => l.scheduledAt),
    )
    return NextResponse.json({ slots })
  }

  // Retorna datas disponíveis nos próximos 30 dias
  const availableDates = getAvailableDates(availability, 30)
  return NextResponse.json({
    dates: availableDates.map((d) => d.toISOString().slice(0, 10)),
  })
}
