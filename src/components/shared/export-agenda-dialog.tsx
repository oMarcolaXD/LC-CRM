"use client"

import { useState } from "react"
import { Printer, Copy, FileText, Users, User, Check, MessageSquare } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { LessonSlot, TeacherCol } from "@/app/(colaborador)/colaborador/agenda/agenda-grid"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ExportAgendaDialogProps {
  open: boolean
  onClose: () => void
  dateStr: string
  teachers: TeacherCol[]
  lessons: LessonSlot[]
}

type GroupBy = "teacher" | "student" | "general"

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  MISSED:    "Faltou",
}

function calculateEndTime(startTimeStr: string, durationMinutes: number): string {
  if (!startTimeStr) return ""
  const [h, m] = startTimeStr.split(":").map(Number)
  const totalMinutes = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m) + (durationMinutes || 60)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
}

function getGreeting(exclamationCount: number = 2): string {
  const hour = new Date().getHours()
  const ex = "!".repeat(exclamationCount)
  if (hour < 12) return `🌞 Bom dia${ex}`
  if (hour < 18) return `🌞 Boa tarde${ex}`
  return `🌙 Boa noite${ex}`
}

function getWeekdayPrep(weekdayStr: string): string {
  const lower = weekdayStr.toLowerCase()
  if (lower.includes("feira") || lower.startsWith("terça")) return "na"
  return "no"
}

export function generateStudentWhatsappText(
  studentName: string,
  studentLessons: LessonSlot[],
  teachers: TeacherCol[],
  dateStr: string
): string {
  const parsedDate = parseISO(dateStr)
  const formattedDateShort = format(parsedDate, "dd/MM/yyyy")
  const weekdayName = format(parsedDate, "EEEE", { locale: ptBR })
  const prep = getWeekdayPrep(weekdayName)

  const greeting = getGreeting(3)
  const hasMultiple = studentLessons.length > 1
  const lessonHeader = hasMultiple
    ? `Você tem aulas agendadas ${prep} ${weekdayName} (${formattedDateShort})!`
    : `Você tem uma aula agendada ${prep} ${weekdayName} (${formattedDateShort})!`

  let text = `*CONFIRMAÇÃO*\n\n`
  text += `${greeting} Tudo bem? ${lessonHeader}\n\n`

  const sortedLessons = [...studentLessons].sort((a, b) => a.startMin - b.startMin)
  const lessonBlocks = sortedLessons.map(l => {
    const teacherName = teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."
    const startTime = l.time
    const endTime = calculateEndTime(startTime, l.duration)

    let formatTag = ""
    if (l.lessonType === "AULAO") {
      formatTag = "Aulão"
    } else if (l.isGroupLesson || l.lessonType === "GROUP") {
      formatTag = l.groupSize === 2 ? "Em Dupla" : "Em Grupo"
    }

    let modStr = ""
    if (l.modality === "ONLINE" && formatTag) {
      modStr = ` (${formatTag} - Online)`
    } else if (l.modality === "ONLINE") {
      modStr = " (Online)"
    } else if (formatTag) {
      modStr = ` (${formatTag})`
    }

    const nameToUse = l.studentName || studentName
    const subjectTitle = l.lessonType === "AULAO" && l.title ? l.title : l.subjectName

    return [
      `*Aluno:* ${nameToUse}.`,
      `*Data:* ${formattedDateShort} (${weekdayName})`,
      `*Horário:* das ${startTime} às ${endTime}.`,
      `*Matéria:* ${subjectTitle}${modStr}.`,
      `*Professor:* ${teacherName}.`,
    ].join("\n")
  })

  text += lessonBlocks.join("\n\n") + "\n\n"
  text += `Podemos confirmar?\n\n`
  text += `‼️ATENÇÃO‼️\n`
  text += `_*Cancelamento e reagendamentos de aula(s) devem ser feitos antes de 24 horas. Tempo necessário para o(a) professor(a) reorganizar a sua agenda e não ter prejuízos*_\n\n`
  text += `*Cancelamentos fora do prazo cobramos 100% do valor da aula.*`

  return text
}

export function generateTeacherWhatsappText(
  teacherName: string,
  teacherLessons: LessonSlot[],
  dateStr: string
): string {
  const parsedDate = parseISO(dateStr)
  const formattedDateShort = format(parsedDate, "dd/MM/yyyy")
  const weekdayName = format(parsedDate, "EEEE", { locale: ptBR })

  const greeting = getGreeting(2)

  let text = `*CONFIRMAÇÃO*\n\n`
  text += `${greeting} Tudo bem? Seguem as aulas agendadas de ${weekdayName} (${formattedDateShort})!\n\n`

  const sortedLessons = [...teacherLessons].sort((a, b) => a.startMin - b.startMin)
  const lessonBlocks = sortedLessons.map(l => {
    const startTime = l.time
    const endTime = calculateEndTime(startTime, l.duration)

    let formatTag = ""
    if (l.lessonType === "AULAO") {
      formatTag = "Aulão"
    } else if (l.isGroupLesson || l.lessonType === "GROUP") {
      formatTag = l.groupSize === 2 ? "Em Dupla" : "Em Grupo"
    }

    let modStr = ""
    if (l.modality === "ONLINE" && formatTag) {
      modStr = ` (${formatTag} - Online)`
    } else if (l.modality === "ONLINE") {
      modStr = " (Online)"
    } else if (formatTag) {
      modStr = ` (${formatTag})`
    }

    let studentDisplayName = l.studentName || (l.lessonType === "COMPROMISSO" ? (l.title ?? "Compromisso") : "Aluno")
    if (l.isGroupLesson && l.groupMates && l.groupMates.length > 0) {
      studentDisplayName = `${studentDisplayName} e ${l.groupMates.join(", ")}`
    } else if (l.lessonType === "AULAO") {
      studentDisplayName = `${l.title ?? "Aulão"} (${l.groupSize ?? l.capacity ?? "Turma"} alunos)`
    }

    const subjectTitle = l.lessonType === "AULAO" && l.title ? l.title : l.subjectName

    return [
      `*Aluno:* ${studentDisplayName}.`,
      `*Horário:* das ${startTime} às ${endTime}.`,
      `*Matéria:* ${subjectTitle}${modStr}.`,
    ].join("\n")
  })

  text += lessonBlocks.join("\n\n")

  return text
}

export function generateGeneralWhatsappText(
  activeLessons: LessonSlot[],
  teachers: TeacherCol[],
  dateStr: string
): string {
  const parsedDate = parseISO(dateStr)
  const formattedDateShort = format(parsedDate, "dd/MM/yyyy")

  let text = `📅 *AGENDA GERAL DE AULAS — ${formattedDateShort}*\n\n`
  const sortedAll = [...activeLessons].sort((a, b) => a.startMin - b.startMin)

  for (const l of sortedAll) {
    const tName = teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."
    const mod = l.modality === "ONLINE" ? "Online" : "Presencial"
    const sName = l.studentName || (l.lessonType === "COMPROMISSO" ? (l.title ?? "Compromisso") : "Aluno")
    text += `• *${l.time}* | ${sName} — ${l.subjectName} (${tName} · ${mod})\n`
  }

  text += `\n— Lição de Casa CRM`
  return text
}

export function ExportAgendaDialog({
  open,
  onClose,
  dateStr,
  teachers,
  lessons,
}: ExportAgendaDialogProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("student")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const parsedDate = parseISO(dateStr)
  const formattedDate = format(parsedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const formattedDateShort = format(parsedDate, "dd/MM/yyyy")

  // Filtra apenas aulas ativas (exclui canceladas por padrão)
  const activeLessons = lessons.filter(l => l.status !== "CANCELLED")

  // Agrupamento por Professor
  const lessonsByTeacher = teachers.map(t => {
    const tLessons = activeLessons
      .filter(l => l.teacherId === t.id)
      .sort((a, b) => a.startMin - b.startMin)
    return {
      teacher: t,
      lessons: tLessons,
    }
  }).filter(g => g.lessons.length > 0)

  // Agrupamento por Aluno / Responsável
  const studentMap = new Map<string, { studentName: string; guardianName: string | null; lessons: LessonSlot[] }>()
  for (const l of activeLessons) {
    const key = l.studentId || l.studentName
    const existing = studentMap.get(key)
    if (existing) {
      existing.lessons.push(l)
    } else {
      studentMap.set(key, {
        studentName: l.studentName,
        guardianName: l.guardianName,
        lessons: [l],
      })
    }
  }
  const lessonsByStudent = Array.from(studentMap.values()).map(g => ({
    ...g,
    lessons: g.lessons.sort((a, b) => a.startMin - b.startMin),
  }))

  function copyToClipboard(text: string, key: string, successMsg: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(successMsg)
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev))
    }, 2500)
  }

  function handleCopyAllFooter() {
    if (groupBy === "student") {
      const allMsgs = lessonsByStudent
        .map(g => generateStudentWhatsappText(g.studentName, g.lessons, teachers, dateStr))
        .join("\n\n-----------------------------------\n\n")
      copyToClipboard(allMsgs, "footer-all", "Todas as mensagens de alunos copiadas!")
    } else if (groupBy === "teacher") {
      const allMsgs = lessonsByTeacher
        .map(g => generateTeacherWhatsappText(g.teacher.name, g.lessons, dateStr))
        .join("\n\n-----------------------------------\n\n")
      copyToClipboard(allMsgs, "footer-all", "Todas as mensagens de professores copiadas!")
    } else {
      const text = generateGeneralWhatsappText(activeLessons, teachers, dateStr)
      copyToClipboard(text, "footer-all", "Agenda geral copiada para a área de transferência!")
    }
  }

  // Gera e abre a janela de impressão em PDF
  function handlePrintPDF() {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está ativo.")
      return
    }

    let bodyHtml = ""

    if (groupBy === "teacher") {
      bodyHtml = lessonsByTeacher.map(group => `
        <div class="section-group">
          <h3 class="section-title">👨‍🏫 ${group.teacher.name}</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Horário</th>
                <th>Aluno</th>
                <th>Responsável</th>
                <th>Matéria</th>
                <th style="width: 100px;">Modalidade</th>
                <th style="width: 90px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${group.lessons.map(l => `
                <tr>
                  <td class="font-bold">${l.time}</td>
                  <td>${l.studentName || (l.lessonType === "COMPROMISSO" ? (l.title ?? "Compromisso") : "Aluno")}</td>
                  <td>${l.guardianName ?? "—"}</td>
                  <td>${l.subjectName}</td>
                  <td><span class="badge ${l.modality === "ONLINE" ? "badge-blue" : "badge-orange"}">${l.modality === "ONLINE" ? "Online" : "Presencial"}</span></td>
                  <td><span class="badge badge-gray">${STATUS_LABEL[l.status] ?? l.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `).join("")
    } else if (groupBy === "student") {
      bodyHtml = lessonsByStudent.map(group => `
        <div class="section-group">
          <h3 class="section-title">🎓 ${group.studentName} ${group.guardianName ? `<span class="subtext">(Resp: ${group.guardianName})</span>` : ""}</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Horário</th>
                <th>Professor</th>
                <th>Matéria</th>
                <th style="width: 100px;">Modalidade</th>
                <th style="width: 90px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${group.lessons.map(l => {
                const tName = teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."
                return `
                <tr>
                  <td class="font-bold">${l.time}</td>
                  <td>${tName}</td>
                  <td>${l.subjectName}</td>
                  <td><span class="badge ${l.modality === "ONLINE" ? "badge-blue" : "badge-orange"}">${l.modality === "ONLINE" ? "Online" : "Presencial"}</span></td>
                  <td><span class="badge badge-gray">${STATUS_LABEL[l.status] ?? l.status}</span></td>
                </tr>
              `}).join("")}
            </tbody>
          </table>
        </div>
      `).join("")
    } else {
      const sortedAll = [...activeLessons].sort((a, b) => a.startMin - b.startMin)
      bodyHtml = `
        <div class="section-group">
          <h3 class="section-title">📋 Lista Cronológica de Aulas</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Horário</th>
                <th>Aluno</th>
                <th>Responsável</th>
                <th>Professor</th>
                <th>Matéria</th>
                <th style="width: 100px;">Modalidade</th>
                <th style="width: 90px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${sortedAll.map(l => {
                const tName = teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."
                return `
                <tr>
                  <td class="font-bold">${l.time}</td>
                  <td>${l.studentName || (l.lessonType === "COMPROMISSO" ? (l.title ?? "Compromisso") : "Aluno")}</td>
                  <td>${l.guardianName ?? "—"}</td>
                  <td>${tName}</td>
                  <td>${l.subjectName}</td>
                  <td><span class="badge ${l.modality === "ONLINE" ? "badge-blue" : "badge-orange"}">${l.modality === "ONLINE" ? "Online" : "Presencial"}</span></td>
                  <td><span class="badge badge-gray">${STATUS_LABEL[l.status] ?? l.status}</span></td>
                </tr>
              `}).join("")}
            </tbody>
          </table>
        </div>
      `
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Agenda de Aulas — ${formattedDateShort}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            background: #fff;
            padding: 24px;
            font-size: 13px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #fb8500;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #fb8500;
            letter-spacing: -0.5px;
          }
          .brand-subtitle {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .meta-info {
            text-align: right;
          }
          .meta-date {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            text-transform: capitalize;
          }
          .meta-summary {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .section-group {
            margin-bottom: 24px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            background: #f8fafc;
            padding: 8px 12px;
            border-left: 4px solid #219ebc;
            border-radius: 4px;
            margin-bottom: 10px;
          }
          .subtext {
            font-weight: 400;
            font-size: 12px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            text-align: left;
            padding: 8px 10px;
            font-weight: 600;
            color: #475569;
            border-bottom: 1px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 9px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          .font-bold { font-weight: 700; color: #0f172a; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 600;
          }
          .badge-orange { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
          .badge-blue { background: #f0f9ff; color: #0369a1; border: 1px solid #e0f2fe; }
          .badge-gray { background: #f1f5f9; color: #475569; }
          .footer {
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div>
              <div class="brand-title">Lição de Casa</div>
              <div class="brand-subtitle">Gestão de Aulas Particulares</div>
            </div>
          </div>
          <div class="meta-info">
            <div class="meta-date">${formattedDate}</div>
            <div class="meta-summary">${activeLessons.length} aulas agendadas · ${teachers.length} professores</div>
          </div>
        </div>

        ${bodyHtml}

        <div class="footer">
          <span>Relatório gerado em ${new Date().toLocaleString("pt-BR")}</span>
          <span>Lição de Casa CRM — licaodecasa.com.br</span>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Baixar / Imprimir Agenda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground mb-0.5">
              📅 {formattedDate}
            </p>
            <p>
              {activeLessons.length} aula{activeLessons.length !== 1 ? "s" : ""} no dia ·{" "}
              {lessonsByTeacher.length} professor{lessonsByTeacher.length !== 1 ? "es ativos" : " ativo"}
            </p>
          </div>

          {/* Modo de Agrupamento */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Agrupar Relatório Por:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGroupBy("student")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  groupBy === "student"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Users className="w-4 h-4 mb-1" />
                Por Aluno
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("teacher")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  groupBy === "teacher"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <User className="w-4 h-4 mb-1" />
                Por Professor
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("general")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  groupBy === "general"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <FileText className="w-4 h-4 mb-1" />
                Agenda Geral
              </button>
            </div>
          </div>

          {/* Pré-visualização com botões de cópia direta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                Mensagens Prontas para WhatsApp
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {groupBy === "teacher" ? `${lessonsByTeacher.length} professores` : groupBy === "student" ? `${lessonsByStudent.length} alunos` : `${activeLessons.length} aulas`}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 max-h-72 overflow-y-auto text-xs space-y-3">
              {groupBy === "student" ? (
                lessonsByStudent.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhuma aula agendada para alunos neste dia.</p>
                ) : (
                  lessonsByStudent.map(g => {
                    const key = `student-${g.studentName}`
                    const isCopied = copiedKey === key

                    return (
                      <div key={g.studentName} className="p-2.5 rounded-md border border-border/70 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-foreground text-xs">{g.studentName}</span>
                            {g.guardianName && (
                              <span className="text-[11px] text-muted-foreground ml-1.5">(Resp: {g.guardianName})</span>
                            )}
                            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {g.lessons.length} {g.lessons.length === 1 ? "aula" : "aulas"}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(
                              generateStudentWhatsappText(g.studentName, g.lessons, teachers, dateStr),
                              key,
                              `Mensagem para ${g.studentName} copiada!`
                            )}
                            className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 shrink-0 font-medium"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                            {isCopied ? "Copiado!" : "Copiar Msg Aluno"}
                          </Button>
                        </div>

                        <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                          {g.lessons.map(l => (
                            <div key={l.id} className="text-muted-foreground text-[11px] flex items-center justify-between gap-2">
                              <span className="truncate">
                                • <strong className="text-foreground">{l.time}</strong> - {l.subjectName} com {teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${l.modality === "ONLINE" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-orange-50 text-orange-700 border border-orange-200"}`}>
                                {l.modality === "ONLINE" ? "Online" : "Presencial"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )
              ) : groupBy === "teacher" ? (
                lessonsByTeacher.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum professor com aulas agendadas neste dia.</p>
                ) : (
                  lessonsByTeacher.map(g => {
                    const key = `teacher-${g.teacher.id}`
                    const isCopied = copiedKey === key

                    return (
                      <div key={g.teacher.id} className="p-2.5 rounded-md border border-border/70 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-foreground text-xs">{g.teacher.name}</span>
                            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {g.lessons.length} {g.lessons.length === 1 ? "aula" : "aulas"}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(
                              generateTeacherWhatsappText(g.teacher.name, g.lessons, dateStr),
                              key,
                              `Mensagem para Prof. ${g.teacher.name} copiada!`
                            )}
                            className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 shrink-0 font-medium"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                            {isCopied ? "Copiado!" : "Copiar Msg Professor"}
                          </Button>
                        </div>

                        <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                          {g.lessons.map(l => (
                            <div key={l.id} className="text-muted-foreground text-[11px] flex items-center justify-between gap-2">
                              <span className="truncate">
                                • <strong className="text-foreground">{l.time}</strong> - {l.studentName} ({l.subjectName})
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${l.modality === "ONLINE" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-orange-50 text-orange-700 border border-orange-200"}`}>
                                {l.modality === "ONLINE" ? "Online" : "Presencial"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )
              ) : (
                activeLessons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhuma aula para exibir.</p>
                ) : (
                  [...activeLessons].sort((a,b) => a.startMin - b.startMin).map(l => (
                    <div key={l.id} className="text-muted-foreground text-[11px] flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-b-0">
                      <span className="truncate">
                        • <strong className="text-foreground">{l.time}</strong> - {l.studentName} ({l.subjectName} com {teachers.find(t => t.id === l.teacherId)?.name ?? "Prof."})
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${l.modality === "ONLINE" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-orange-50 text-orange-700 border border-orange-200"}`}>
                        {l.modality === "ONLINE" ? "Online" : "Presencial"}
                      </span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyAllFooter}
            className="w-full sm:w-auto gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
          >
            {copiedKey === "footer-all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === "footer-all" ? "Copiado!" : groupBy === "student" ? "Copiar Todas (Alunos)" : groupBy === "teacher" ? "Copiar Todas (Professores)" : "Copiar Agenda Geral"}
          </Button>

          <Button
            type="button"
            onClick={handlePrintPDF}
            className="w-full sm:w-auto gap-1.5 bg-primary text-white hover:bg-primary/90"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir / Salvar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
