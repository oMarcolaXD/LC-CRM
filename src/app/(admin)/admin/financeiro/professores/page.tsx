import { prisma }              from "@/lib/prisma"
import { PageHeader }          from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }               from "@/components/ui/badge"
import { Button }              from "@/components/ui/button"
import { generatePayoutFormAction } from "./actions"
import { PayoutActions }       from "./payout-actions"
import { Wallet, Plus, AlertCircle } from "lucide-react"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

interface ProfessoresPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function RepasesPage({ searchParams }: ProfessoresPageProps) {
  const { error, success } = await searchParams
  const now = new Date()

  const [payouts, teachers] = await Promise.all([
    prisma.teacherPayout.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take:    50,
    }),
    prisma.teacher.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="REPASSES DE PROFESSORES" backHref="/admin/financeiro" />

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{decodeURIComponent(success)}</div>}
      {error   && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{decodeURIComponent(error)}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calcular repasse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Calcular Repasse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action={generatePayoutFormAction}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Professor *</label>
                <select name="teacherId" required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecione</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.name} — R$ {Number(t.hourlyRate).toFixed(2)}/aula
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mês *</label>
                  <select name="month" required defaultValue={now.getMonth() + 1}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ano *</label>
                  <select name="year" required defaultValue={now.getFullYear()}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {[now.getFullYear(), now.getFullYear()-1].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Calcula automaticamente o total de aulas realizadas × valor/aula do professor.
              </p>
              <Button type="submit" className="w-full">Calcular</Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de repasses */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Repasses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum repasse calculado</p>
            ) : (
              <div className="space-y-2">
                {payouts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border">
                    <div>
                      <p className="font-medium text-sm">{r.teacher.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {MONTHS[r.month - 1]}/{r.year} · {r.totalLessons} aulas
                      </p>
                      {r.paidAt && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Pago em {new Date(r.paidAt).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-base font-bold">{brl(Number(r.totalAmount))}</p>
                      <Badge variant={r.status === "PAID" ? "default" : "secondary"}>
                        {r.status === "PAID" ? "Pago" : "Pendente"}
                      </Badge>
                      <PayoutActions id={r.id} status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
