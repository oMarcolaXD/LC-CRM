import Link                    from "next/link"
import { prisma }              from "@/lib/prisma"
import { PageHeader }         from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input }              from "@/components/ui/input"
import { Label }              from "@/components/ui/label"
import { setRoomCountAction } from "@/lib/actions/config"
import { getOperationalConfig, isWhatsAppEnabled } from "@/lib/config"
import { SubjectManager }     from "./subject-manager"
import { OperationalConfigForm } from "./operational-config"
import { WhatsAppToggle }     from "./whatsapp-toggle"
import {
  DoorOpen, BookOpen, Settings, Info, AlertCircle, CheckCircle2,
  Clock, MessageCircle, MessageSquareText,
} from "lucide-react"

async function getRoomCount() {
  const row = await prisma.systemConfig.findUnique({ where: { key: "room_count" } })
  return parseInt(row?.value ?? "3", 10) || 3
}

interface ConfigPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function AdminConfigPage({ searchParams }: ConfigPageProps) {
  const [roomCount, subjects, opConfig, whatsappEnabled, { error, success }] = await Promise.all([
    getRoomCount(),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    getOperationalConfig(),
    isWhatsAppEnabled(),
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

      {/* ── Notificações WhatsApp ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Notificações via WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">Envio de mensagens via WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Quando desativado, nenhuma mensagem é enviada — útil enquanto a integração
                está em testes.
              </p>
            </div>
            <WhatsAppToggle enabled={whatsappEnabled} />
          </div>

          <Link href="/admin/config/mensagens" className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full"}>
            <MessageSquareText className="w-4 h-4 mr-2" />
            Configurar mensagens padrão
          </Link>
        </CardContent>
      </Card>

      {/* ── Horário de Funcionamento ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horário de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <OperationalConfigForm
            days={opConfig.days}
            startTime={opStart}
            endTime={opEnd}
            closedDates={opConfig.closedDates}
          />
        </CardContent>
      </Card>

    </div>
  )
}
