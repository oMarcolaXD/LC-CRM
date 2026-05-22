import { prisma } from "./prisma"
import { getDay }  from "date-fns"

export async function getConfigValue(key: string, fallback: string): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  return row?.value ?? fallback
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  })
}

export async function getRoomCount(): Promise<number> {
  const val = await getConfigValue("room_count", "3")
  return Math.max(1, parseInt(val, 10) || 3)
}

// ─── Horário de Funcionamento ─────────────────────────────────────────────────

export interface OperationalConfig {
  days:        number[]  // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  startMin:    number    // minutos desde meia-noite (ex: 8*60 = 480)
  endMin:      number
  closedDates: string[]  // "yyyy-MM-dd" — feriados/fechamentos excepcionais
}

function parseDates(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export async function getOperationalConfig(): Promise<OperationalConfig> {
  const [days, start, end, closed] = await Promise.all([
    getConfigValue("operational_days",         "1,2,3,4,5,6"),  // Seg–Sáb
    getConfigValue("operational_start",        "08:00"),
    getConfigValue("operational_end",          "20:00"),
    getConfigValue("operational_closed_dates", "[]"),
  ])

  const [sh = 8,  sm = 0]  = start.split(":").map(Number)
  const [eh = 20, em = 0]  = end.split(":").map(Number)

  return {
    days:        days.split(",").map(Number).filter(d => d >= 0 && d <= 6),
    startMin:    sh * 60 + sm,
    endMin:      eh * 60 + em,
    closedDates: parseDates(closed),
  }
}

export function isOperational(date: Date, cfg: OperationalConfig): boolean {
  const dow     = getDay(date)                                      // 0–6
  const dateStr = date.toISOString().slice(0, 10)                  // "yyyy-MM-dd"
  const timeMin = date.getHours() * 60 + date.getMinutes()

  if (!cfg.days.includes(dow))           return false
  if (cfg.closedDates.includes(dateStr)) return false
  if (timeMin < cfg.startMin)            return false
  if (timeMin >= cfg.endMin)             return false
  return true
}
