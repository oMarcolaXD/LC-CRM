"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { LayoutList, CalendarDays, CalendarCheck, CheckCircle2, Link2, Download, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TeacherWeekCalendar, type CalendarLesson } from "./teacher-week-calendar"
import { cn } from "@/lib/utils"

const STATUS_CFG = {
  SCHEDULED: { label: "Agendada",   variant: "secondary"   as const },
  CONFIRMED: { label: "Confirmada", variant: "default"     as const },
  COMPLETED: { label: "Realizada",  variant: "outline"     as const },
  CANCELLED: { label: "Cancelada",  variant: "destructive" as const },
  MISSED:    { label: "Faltou",     variant: "destructive" as const },
}

type View = "list" | "calendar"

interface Props {
  lessons:       CalendarLesson[]
  calendarToken: string
  baseUrl:       string
}

export function TeacherAgendaView({ lessons, calendarToken, baseUrl }: Props) {
  const [view, setView]       = useState<View>("list")
  const [copied, setCopied]   = useState(false)

  const upcoming = lessons.filter((l) => ["SCHEDULED", "CONFIRMED"].includes(l.status))
  const past     = lessons.filter((l) => ["COMPLETED", "CANCELLED", "MISSED"].includes(l.status))

  const icsUrl      = `${baseUrl}/api/professor/calendar/${calendarToken}`
  const webcalUrl   = icsUrl.replace(/^https?/, "webcal")

  function copyUrl() {
    navigator.clipboard.writeText(icsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* ── View toggle ── */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["list", "calendar"] as View[]).map((v) => {
            const Icon = v === "list" ? LayoutList : CalendarDays
            const label = v === "list" ? "Lista" : "Calendário"
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
                  view === v
                    ? "bg-primary text-white"
                    : "bg-background text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )
          })}
        </div>

        {/* Sync button */}
        <div className="flex items-center gap-2">
          <a
            href={icsUrl}
            download="agenda-licaodecasa.ics"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Baixar .ics
          </a>
          <Button
            variant="outline" size="sm"
            className={cn("text-xs gap-1.5 h-8", copied && "text-green-600 border-green-600")}
            onClick={copyUrl}
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
        </div>
      </div>

      {/* ── Sync instructions (collapsible hint) ── */}
      <SyncHint webcalUrl={webcalUrl} icsUrl={icsUrl} />

      {/* ── Calendar view ── */}
      {view === "calendar" && (
        <TeacherWeekCalendar lessons={lessons} />
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" /> Próximas Aulas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarCheck className="w-10 h-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma aula agendada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((lesson) => (
                    <a
                      key={lesson.id}
                      href={`/professor/agenda/${lesson.id}`}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex gap-3 min-w-0">
                        <div className="shrink-0 text-center w-12">
                          <p className="text-lg font-bold text-primary">
                            {format(new Date(lesson.scheduledAt), "dd")}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {format(new Date(lesson.scheduledAt), "MMM", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(lesson.scheduledAt), "HH:mm")}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{lesson.student.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.subject.name} · {lesson.modality === "ONLINE" ? "Online" : "Presencial"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={STATUS_CFG[lesson.status as keyof typeof STATUS_CFG]?.variant}>
                          {STATUS_CFG[lesson.status as keyof typeof STATUS_CFG]?.label}
                        </Badge>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-sub text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" /> Histórico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {past.slice(0, 10).map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{lesson.student.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.subject.name} · {format(new Date(lesson.scheduledAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={STATUS_CFG[lesson.status as keyof typeof STATUS_CFG]?.variant}>
                      {STATUS_CFG[lesson.status as keyof typeof STATUS_CFG]?.label}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/* ── Sync hint card ─────────────────────────────────────── */
function SyncHint({ webcalUrl, icsUrl }: { webcalUrl: string; icsUrl: string }) {
  const [open, setOpen] = useState(false)

  const googleSteps = [
    { n: "1", text: <>Acesse <span className="font-mono text-[10px] bg-muted rounded px-1 py-0.5">calendar.google.com</span></> },
    { n: "2", text: <>No menu lateral, clique em <strong>+</strong> ao lado de "Outros agendas" e escolha <strong>"De URL"</strong></> },
    { n: "3", text: <>Cole o link copiado (botão "Copiar link" acima) e clique em <strong>"Adicionar agenda"</strong></> },
  ]

  return (
    <div className="rounded-xl border border-border bg-muted/10">
      {/* trigger */}
      <button
        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-xl"
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays className="w-4 h-4 text-brand-blue shrink-0" />
        <span className="text-foreground/80">Como sincronizar com Google Agenda, Apple Calendar ou Outlook?</span>
        <span className="ml-auto text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">

          {/* Google Calendar */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue pt-2">
              Google Agenda
            </p>
            <div className="space-y-2">
              {googleSteps.map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {n}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-border" />

          {/* Apple / Outlook */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
              Apple Calendar · Outlook · outros
            </p>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                1
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clique em <strong>"Baixar .ics"</strong> para importar manualmente, ou use o{" "}
                <a href={webcalUrl} className="text-brand-blue underline underline-offset-2 hover:opacity-75">
                  link webcal://
                </a>{" "}
                para assinar e receber atualizações automáticas.
              </p>
            </div>
          </div>

          {/* Info note */}
          <p className="text-[11px] text-muted-foreground/70 bg-muted/40 rounded-lg px-3 py-2">
            As novas aulas aparecem automaticamente na sua agenda pessoal — sem precisar repetir esse processo.
          </p>
        </div>
      )}
    </div>
  )
}
