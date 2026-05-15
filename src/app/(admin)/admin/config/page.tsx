import { prisma }              from "@/lib/prisma"
import { PageHeader }         from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button }             from "@/components/ui/button"
import { Input }              from "@/components/ui/input"
import { Label }              from "@/components/ui/label"
import { setRoomCountAction } from "@/lib/actions/config"
import { DoorOpen, Settings, Info, AlertCircle, CheckCircle2 } from "lucide-react"

async function getRoomCount() {
  const row = await prisma.systemConfig.findUnique({ where: { key: "room_count" } })
  return parseInt(row?.value ?? "3", 10) || 3
}

interface ConfigPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function AdminConfigPage({ searchParams }: ConfigPageProps) {
  const [roomCount, { error, success }] = await Promise.all([
    getRoomCount(),
    searchParams,
  ])

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

        {/* ── Mais configs podem ser adicionadas aqui ────────────── */}
        <Card className="border-dashed opacity-50">
          <CardContent className="flex flex-col items-center justify-center h-full py-10 text-center gap-2">
            <Settings className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Mais configurações em breve</p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
