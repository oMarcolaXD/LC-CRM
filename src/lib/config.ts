import { prisma } from "./prisma"

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
