import { prisma }         from "@/lib/prisma"
import { PageHeader }     from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }          from "@/components/ui/badge"
import { Button }         from "@/components/ui/button"
import { Input }          from "@/components/ui/input"
import { Label }          from "@/components/ui/label"
import { createPaymentAction } from "@/lib/actions/financeiro"
import { PaymentActions } from "./payment-actions"
import { DollarSign, Plus, AlertCircle } from "lucide-react"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

const STATUS_CFG = {
  PENDING:  { label: "Pendente",    variant: "secondary"   as const },
  PAID:     { label: "Pago",        variant: "default"     as const },
  OVERDUE:  { label: "Vencido",     variant: "destructive" as const },
}

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

interface PagamentosPageProps {
  searchParams: Promise<{ error?: string; success?: string; filter?: string }>
}

export default async function PagamentosPage({ searchParams }: PagamentosPageProps) {
  const { error, success, filter } = await searchParams

  const [payments, students] = await Promise.all([
    prisma.payment.findMany({
      where:   filter ? { status: filter as "PENDING" | "PAID" | "OVERDUE" } : undefined,
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
      take:    100,
    }),
    prisma.student.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ])

  const totals = { PENDING: 0, PAID: 0, OVERDUE: 0 }
  payments.forEach((p) => { totals[p.status] += Number(p.amount) })

  return (
    <div className="space-y-6">
      <PageHeader title="COBRANÇAS" backHref="/admin/financeiro" />

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{decodeURIComponent(success)}</div>}
      {error   && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{decodeURIComponent(error)}</div>}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {(["PENDING","PAID","OVERDUE"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{STATUS_CFG[s].label}</p>
              <p className="text-lg font-bold mt-1">{brl(totals[s])}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário nova cobrança */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Nova Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPaymentAction} className="space-y-4">
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <select name="studentId" required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecione o aluno</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.user?.name ?? "Aluno"}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input name="amount" type="number" min="0.01" step="0.01" placeholder="640.00" required />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento *</Label>
                  <Input name="dueDate" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <select name="method"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Não definido</option>
                  <option value="PIX">PIX</option>
                  <option value="CARTAO">Cartão</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="DINHEIRO">Dinheiro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input name="description" placeholder="Ex: Pacote 8 aulas — Maio/2025" />
              </div>
              <Button type="submit" className="w-full">Gerar Cobrança</Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Cobranças
              </span>
              <div className="flex gap-1">
                {[{v:"",l:"Todas"},{v:"PENDING",l:"Pendentes"},{v:"OVERDUE",l:"Vencidas"},{v:"PAID",l:"Pagas"}].map(({v,l}) => (
                  <a key={v} href={`?filter=${v}`}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${filter===v||(v===""&&!filter)?"bg-primary text-white":"hover:bg-muted text-muted-foreground"}`}>
                    {l}
                  </a>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.student.name ?? "Aluno"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.description ?? "Cobrança"} · Vence {format(p.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                        {p.method && ` · ${p.method}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-bold">{brl(Number(p.amount))}</p>
                      <Badge variant={STATUS_CFG[p.status].variant}>{STATUS_CFG[p.status].label}</Badge>
                      <PaymentActions id={p.id} status={p.status} />
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
