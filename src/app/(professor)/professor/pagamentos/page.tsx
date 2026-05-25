import { auth }        from "@/lib/auth"
import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import { Wallet, TrendingUp, BookOpen } from "lucide-react"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

export default async function ProfessorPagamentosPage() {
  const session = await auth()
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session?.user?.email ?? "" } },
  })

  const now = new Date()
  const [payouts, aulasDoMes] = await Promise.all([
    teacher ? prisma.teacherPayout.findMany({
      where:   { teacherId: teacher.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }) : [],
    teacher ? prisma.lesson.count({
      where: {
        teacherId: teacher.id, status: "COMPLETED",
        scheduledAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
      },
    }) : 0,
  ])

  const rate          = Number(teacher?.hourlyRate ?? 0)
  const projecaoMes   = aulasDoMes * rate
  const totalRecebido = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.totalAmount), 0)
  const aPagar        = payouts.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.totalAmount), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="MEUS PAGAMENTOS" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Recebido",  value: brl(totalRecebido), icon: TrendingUp, color: "text-green-600",  bg: "bg-green-50"   },
          { label: "A Receber",       value: brl(aPagar),        icon: Wallet,     color: "text-primary",    bg: "bg-primary/10" },
          { label: "Projeção do Mês", value: brl(projecaoMes),   icon: BookOpen,   color: "text-secondary",  bg: "bg-secondary/10"},
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2.5 rounded-xl`}><Icon className={`w-5 h-5 ${color}`} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Histórico de Repasses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl border border-border">
                  <div>
                    <p className="font-medium text-sm">{MONTHS[p.month - 1]}/{p.year}</p>
                    <p className="text-xs text-muted-foreground">{Number(p.totalLessons)} aulas × {brl(rate)}</p>
                    {p.paidAt && <p className="text-xs text-green-600 mt-0.5">Pago em {new Date(p.paidAt).toLocaleDateString("pt-BR")}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-base font-bold">{brl(Number(p.totalAmount))}</p>
                    <Badge variant={p.status === "PAID" ? "default" : "secondary"}>
                      {p.status === "PAID" ? "Pago" : "Pendente"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
