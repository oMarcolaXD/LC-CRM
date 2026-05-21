"use client"

import React, { useState } from "react"
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
type App = "google" | "iphone" | "outlook"

const APP_OPTIONS: { id: App; emoji: string; label: string }[] = [
  { id: "google",  emoji: "🗓️", label: "Google Agenda" },
  { id: "iphone",  emoji: "📱", label: "iPhone / iPad" },
  { id: "outlook", emoji: "💼", label: "Outlook"        },
]

const APP_STEPS: Record<App, { text: React.ReactNode }[]> = {
  google: [
    { text: <>Clique no botão <strong>&quot;Copiar link&quot;</strong> acima.</> },
    { text: <>Abra o <strong>Google Agenda</strong> no computador ou celular.</> },
    { text: <>No menu lateral esquerdo, toque no <strong>&quot;+&quot;</strong> ao lado de &quot;Outros agendas&quot; e escolha <strong>&quot;De URL&quot;</strong>.</> },
    { text: <>Cole o link copiado no campo que aparecer e clique em <strong>&quot;Adicionar agenda&quot;</strong>. Pronto!</> },
  ],
  iphone: [
    { text: <>Clique no botão <strong>&quot;Baixar .ics&quot;</strong> acima.</> },
    { text: <>Seu iPhone vai perguntar se deseja abrir o arquivo — toque em <strong>&quot;Permitir&quot;</strong>.</> },
    { text: <>Na tela seguinte, toque em <strong>&quot;Adicionar todos&quot;</strong> para importar as aulas para o Calendário do iPhone.</> },
  ],
  outlook: [
    { text: <>Clique no botão <strong>&quot;Baixar .ics&quot;</strong> acima.</> },
    { text: <>O arquivo vai abrir automaticamente no Outlook. Clique em <strong>&quot;Importar&quot;</strong> na janela que aparecer.</> },
    { text: <>As aulas serão adicionadas ao seu calendário do Outlook.</> },
  ],
}

function SyncHint({ webcalUrl, icsUrl: _icsUrl }: { webcalUrl: string; icsUrl: string }) {
  const [open,       setOpen]       = useState(false)
  const [activeApp,  setActiveApp]  = useState<App>("google")

  void webcalUrl // available for future use

  const steps = APP_STEPS[activeApp]

  return (
    <div className="rounded-xl border border-border bg-muted/10">
      {/* trigger */}
      <button
        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-xl"
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays className="w-4 h-4 text-brand-blue shrink-0" />
        <span className="text-foreground/80">Quero ver minhas aulas na minha agenda pessoal</span>
        <span className="ml-auto text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">

          {/* App picker */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Qual aplicativo de agenda você usa?</p>
            <div className="flex gap-2 flex-wrap">
              {APP_OPTIONS.map(({ id, emoji, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveApp(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    activeApp === id
                      ? "bg-brand-blue text-white border-brand-blue"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50",
                  )}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map(({ text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Note */}
          <p className="text-[11px] text-muted-foreground/70 bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
            Após configurar uma vez, as próximas aulas aparecem automaticamente na sua agenda — sem precisar repetir nenhum passo.
          </p>
        </div>
      )}
    </div>
  )
}
