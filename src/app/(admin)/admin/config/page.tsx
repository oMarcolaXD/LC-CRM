import { prisma }              from "@/lib/prisma"
import { PageHeader }         from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button }             from "@/components/ui/button"
import { Input }              from "@/components/ui/input"
import { Label }              from "@/components/ui/label"
import {
  setRoomCountAction,
  setOperationalConfigAction,
  addClosedDateAction,
  removeClosedDateAction,
} from "@/lib/actions/config"
import { getOperationalConfig } from "@/lib/config"
import { SubjectManager }     from "./subject-manager"
import {
  DoorOpen, BookOpen, Settings, Info, AlertCircle, CheckCircle2,
  Clock, CalendarX, X,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR }             from "date-fns/locale"

async function getRoomCount() {
  const row = await prisma.systemConfig.findUnique({ where: { key: "room_count" } })
  return parseInt(row?.value ?? "3", 10) || 3
}

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface ConfigPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function AdminConfigPage({ searchParams }: ConfigPageProps) {
  const [roomCount, subjects, opConfig, { error, success }] = await Promise.all([
    getRoomCount(),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    getOperationalConfig(),
    searchParams,
  ])

  const opStart = `${String(Math.floor(opConfig.startMin / 60)).padStart(2, "0")}:${String(opConfig.startMin % 60).padStart(2, "0")}`
  const opEnd   = `${String(Math.floor(opConfig.endMin   / 60)).padStart(2, "0")}:${String(opConfig.endMin   % 60).padStart(2, "0")}`

  return (
    <div className="space-y-6">
      <PageHeader title="CONFIGURAÇÕES" description="Parâmetros gerais do sistema" />

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {decodeURIComponent(success)}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Configuração de Salas ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-primary" />
              Salas Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-primary">{roomCount}</span>
              </div>
              <div>
                <p className="text-sm font-medium">Salas presenciais ativas</p>
                <p className="text-xs text-muted-foreground">
                  Máximo de aulas presenciais simultâneas
                </p>
              </div>
            </div>

            <form action={setRoomCountAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="room_count">Novo número de salas (1–20)</Label>
                <div className="flex gap-2">
                  <Input
                    id="room_count"
                    name="room_count"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={roomCount}
                    className="w-24"
                  />
                  <Button type="submit">
                    <Settings className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            </form>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                Ao atingir o limite, novas aulas <strong>presenciais</strong> no mesmo horário
                serão bloqueadas automaticamente. Aulas <strong>online</strong> não consomem sala
                e podem ser agendadas sem restrição.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Matérias ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Matérias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectManager subjects={subjects} />
          </CardContent>
        </Card>

      </div>

      {/* ── Horário de Funcionamento ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horário de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          <form action={setOperationalConfigAction} className="space-y-5">

            {/* Dias da semana */}
            <div className="space-y-2">
              <Label>Dias de atendimento</Label>
              <div className="flex flex-wrap gap-2">
                {DOW_LABELS.map((label, i) => {
                  const checked = opConfig.days.includes(i)
                  return (
                    <label key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors select-none ${
                      checked
                        ? "bg-primary text-white border-primary"
                        : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                    }`}>
                      <input
                        type="checkbox"
                        name="operational_days"
                        value={String(i)}
                        defaultChecked={checked}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Alunos não podem solicitar aulas em dias fora deste calendário.
              </p>
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <Label>Horário de atendimento</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">Início</span>
                  <Input
                    type="time"
                    name="operational_start"
                    defaultValue={opStart}
                    className="w-32"
                  />
                </div>
                <span className="text-muted-foreground">–</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">Fim</span>
                  <Input
                    type="time"
                    name="operational_end"
                    defaultValue={opEnd}
                    className="w-32"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Agendamentos fora deste intervalo serão bloqueados automaticamente.
              </p>
            </div>

            <Button type="submit" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Salvar funcionamento
            </Button>
          </form>

          {/* Fechamentos excepcionais */}
          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <CalendarX className="w-4 h-4 text-muted-foreground" />
              <Label>Feriados e fechamentos excepcionais</Label>
            </div>

            {opConfig.closedDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {opConfig.closedDates.map(d => (
                  <form key={d} action={removeClosedDateAction} className="inline-flex">
                    <input type="hidden" name="closed_date" value={d} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium hover:bg-rose-100 transition-colors"
                    >
                      {format(parseISO(d), "dd/MM/yyyy", { locale: ptBR })}
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhuma data de fechamento cadastrada.</p>
            )}

            <form action={addClosedDateAction} className="flex items-center gap-2">
              <Input type="date" name="closed_date" className="w-44" />
              <Button type="submit" size="sm" variant="outline">
                Adicionar data
              </Button>
            </form>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                Datas aqui bloqueiam agendamentos mesmo que o professor esteja disponível.
                Ideal para feriados prolongados ou manutenções.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

    </div>
  )
}
