// Templates configuráveis das mensagens enviadas (in-app, e-mail e WhatsApp).
// Cada template usa placeholders {{variavel}} substituídos no envio.

import { prisma }        from "@/lib/prisma"
import { setConfigValue } from "@/lib/config"

export interface MessageTemplateDef {
  id:          string
  label:       string
  description: string
  variables:   string[]
  default:     string
}

export const MESSAGE_TEMPLATES: MessageTemplateDef[] = [
  {
    id:          "lesson_request",
    label:       "Solicitação de aula",
    description: "Enviada ao professor quando um aluno solicita uma aula.",
    variables:   ["aluno", "materia", "horario_preferido"],
    default:     "{{aluno}} solicitou uma aula de {{materia}} para {{horario_preferido}}.",
  },
  {
    id:          "lesson_confirmed_student",
    label:       "Aula confirmada (aluno)",
    description: "Enviada ao aluno quando uma aula é confirmada.",
    variables:   ["materia", "professor", "data_hora", "modalidade"],
    default:     "Sua aula de {{materia}} com {{professor}} foi confirmada.",
  },
  {
    id:          "lesson_confirmed_guardian",
    label:       "Aula confirmada (responsável)",
    description: "Enviada ao responsável pelo botão de confirmação na agenda.",
    variables:   ["aluno", "materia", "professor", "data_hora", "modalidade"],
    default:     "A aula de {{materia}} de {{aluno}} com {{professor}} está confirmada para {{data_hora}}.",
  },
  {
    id:          "lesson_confirmed_teacher",
    label:       "Aula confirmada (professor)",
    description: "Enviada ao professor pelo botão de confirmação na agenda.",
    variables:   ["materia", "data_hora", "modalidade"],
    default:     "Sua aula de {{materia}} está confirmada para {{data_hora}}.",
  },
  {
    id:          "package_low_balance",
    label:       "Saldo de aulas baixo",
    description: "Enviada ao aluno quando restam poucas aulas no pacote.",
    variables:   ["aulas_restantes"],
    default:     "Você tem apenas {{aulas_restantes}} aula(s) restante(s). Renove seu pacote para não perder continuidade.",
  },
  {
    id:          "payment_due",
    label:       "Pagamento próximo do vencimento",
    description: "Enviada quando uma cobrança está perto de vencer.",
    variables:   ["valor", "vencimento"],
    default:     "Você tem uma cobrança de {{valor}} com vencimento em {{vencimento}}.",
  },
  {
    id:          "payment_overdue",
    label:       "Pagamento em atraso",
    description: "Enviada quando uma cobrança já está vencida.",
    variables:   ["valor", "vencimento"],
    default:     "Você tem uma cobrança de {{valor}} em atraso (venceu em {{vencimento}}). Regularize para continuar com suas aulas.",
  },
  {
    id:          "lesson_reminder",
    label:       "Lembrete de aula",
    description: "Enviada ao aluno e ao professor antes da aula (24h e 1h).",
    variables:   ["materia", "pessoa", "tempo", "data_hora"],
    default:     "Sua aula de {{materia}} com {{pessoa}} começa {{tempo}}.",
  },
  {
    id:          "payout_generated",
    label:       "Repasse calculado",
    description: "Enviada ao professor quando o repasse mensal é calculado.",
    variables:   ["valor", "mes", "aulas_realizadas"],
    default:     "Seu repasse de {{valor}} referente a {{mes}} está disponível ({{aulas_realizadas}} aulas realizadas).",
  },
]

function templateConfigKey(id: string): string {
  return `msg_template_${id}`
}

export async function getMessageTemplate(id: string): Promise<string> {
  const def = MESSAGE_TEMPLATES.find(t => t.id === id)
  const row = await prisma.systemConfig.findUnique({ where: { key: templateConfigKey(id) } })
  return row?.value ?? def?.default ?? ""
}

export async function getAllMessageTemplates(): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: MESSAGE_TEMPLATES.map(t => templateConfigKey(t.id)) } },
  })
  const overrides = new Map(rows.map(r => [r.key, r.value]))
  return Object.fromEntries(
    MESSAGE_TEMPLATES.map(t => [t.id, overrides.get(templateConfigKey(t.id)) ?? t.default])
  )
}

export async function setMessageTemplate(id: string, value: string): Promise<void> {
  await setConfigValue(templateConfigKey(id), value)
}

export async function resetMessageTemplate(id: string): Promise<void> {
  await prisma.systemConfig.deleteMany({ where: { key: templateConfigKey(id) } })
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "")
}
