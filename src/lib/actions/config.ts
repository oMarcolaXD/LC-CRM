"use server"

import { auth }           from "@/lib/auth"
import { setConfigValue, getConfigValue } from "@/lib/config"
import { MESSAGE_TEMPLATES, setMessageTemplate, resetMessageTemplate } from "@/lib/notifications/templates"
import { revalidatePath } from "next/cache"
import { redirect }       from "next/navigation"
import { z }              from "zod"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

const roomCountSchema = z.coerce.number().int().min(1).max(20)

export async function setRoomCountAction(formData: FormData) {
  await requireAdmin()
  const raw    = formData.get("room_count")
  const parsed = roomCountSchema.safeParse(raw)
  if (!parsed.success) {
    redirect(`/admin/config?error=${encodeURIComponent("Número de salas inválido (1-20)")}`)
  }
  await setConfigValue("room_count", String(parsed.data))
  revalidatePath("/admin/config")
  redirect("/admin/config?success=Número+de+salas+atualizado+com+sucesso")
}

export async function getRoomCountAction(): Promise<number> {
  const val = await getConfigValue("room_count", "3")
  return Math.max(1, parseInt(val, 10) || 3)
}

// ─── Notificações WhatsApp ─────────────────────────────────────────────────────

export async function setWhatsAppEnabledAction(enabled: boolean) {
  await requireAdmin()
  await setConfigValue("whatsapp_enabled", String(enabled))
  revalidatePath("/admin/config")
}

// ─── Templates de mensagens ─────────────────────────────────────────────────────

export async function saveMessageTemplateAction(formData: FormData) {
  await requireAdmin()

  const id    = String(formData.get("template_id") ?? "")
  const value = String(formData.get("template_value") ?? "").trim()

  const def = MESSAGE_TEMPLATES.find(t => t.id === id)
  if (!def) err("Template inválido")
  if (!value) err("A mensagem não pode ficar vazia")

  await setMessageTemplate(id, value)
  revalidatePath("/admin/config/mensagens")
  redirect("/admin/config/mensagens?success=Mensagem+atualizada+com+sucesso")
}

export async function resetMessageTemplateAction(formData: FormData) {
  await requireAdmin()

  const id  = String(formData.get("template_id") ?? "")
  const def = MESSAGE_TEMPLATES.find(t => t.id === id)
  if (!def) err("Template inválido")

  await resetMessageTemplate(id)
  revalidatePath("/admin/config/mensagens")
  redirect("/admin/config/mensagens?success=Mensagem+restaurada+para+o+padr%C3%A3o")
}

// ─── Horário de Funcionamento ─────────────────────────────────────────────────

function err(msg: string): never {
  redirect(`/admin/config?error=${encodeURIComponent(msg)}`)
}

function parseDates(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export async function setOperationalConfigAction(formData: FormData) {
  await requireAdmin()

  const days  = formData.getAll("operational_days").map(Number)
  const start = String(formData.get("operational_start") ?? "08:00")
  const end   = String(formData.get("operational_end")   ?? "20:00")

  if (days.length === 0)                err("Selecione ao menos um dia de funcionamento")
  if (!/^\d{2}:\d{2}$/.test(start))    err("Horário de início inválido")
  if (!/^\d{2}:\d{2}$/.test(end))      err("Horário de término inválido")

  const [sh] = start.split(":").map(Number)
  const [eh] = end.split(":").map(Number)
  if (sh >= eh) err("Horário de início deve ser anterior ao de término")

  await Promise.all([
    setConfigValue("operational_days",  days.join(",")),
    setConfigValue("operational_start", start),
    setConfigValue("operational_end",   end),
  ])
  revalidatePath("/admin/config")
  redirect("/admin/config?success=Horário+de+funcionamento+atualizado")
}

export async function addClosedDateAction(formData: FormData) {
  await requireAdmin()

  const date = String(formData.get("closed_date") ?? "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err("Data inválida")

  const current = await getConfigValue("operational_closed_dates", "[]")
  const dates   = parseDates(current)
  if (!dates.includes(date)) dates.push(date)
  dates.sort()

  await setConfigValue("operational_closed_dates", JSON.stringify(dates))
  revalidatePath("/admin/config")
  redirect("/admin/config?success=Data+de+fechamento+adicionada")
}

export async function removeClosedDateAction(formData: FormData) {
  await requireAdmin()

  const date    = String(formData.get("closed_date") ?? "")
  const current = await getConfigValue("operational_closed_dates", "[]")
  const dates   = parseDates(current).filter(d => d !== date)

  await setConfigValue("operational_closed_dates", JSON.stringify(dates))
  revalidatePath("/admin/config")
  redirect("/admin/config?success=Data+de+fechamento+removida")
}
