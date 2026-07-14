import { prisma }     from "@/lib/prisma"
import Link           from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }      from "@/components/ui/badge"
import { Search, ChevronRight, Users } from "lucide-react"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function FinanceiroAlunosPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim()

  const students = await prisma.student.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    select: {
      id: true, name: true, grade: true,
      packages: { select: { status: true } },
      payments: { select: { amount: true, status: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  })

  const rows = students.map((s) => {
    const pago     = s.payments.filter((p) => p.status === "PAID").reduce((t, p) => t + Number(p.amount), 0)
    const pendente = s.payments.filter((p) => p.status === "PENDING").reduce((t, p) => t + Number(p.amount), 0)
    const vencido  = s.payments.filter((p) => p.status === "OVERDUE").reduce((t, p) => t + Number(p.amount), 0)
    const pacotesAtivos = s.packages.filter((p) => p.status === "ACTIVE").length
    return { id: s.id, name: s.name, grade: s.grade, pago, pendente, vencido, pacotesAtivos }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="FINANCEIRO POR ALUNO"
        description="Veja pagamentos e pacotes detalhados de cada aluno"
        backHref="/admin/financeiro"
      />

      {/* Busca */}
      <form method="get" className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Buscar aluno pelo nome…"
          className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Users className="w-8 h-8 opacity-40" />
            {query ? "Nenhum aluno encontrado." : "Nenhum aluno cadastrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/financeiro/alunos/${r.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.grade}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                      <span className="text-green-600">Pago: <strong>{brl(r.pago)}</strong></span>
                      {r.pendente > 0 && <span className="text-amber-600">Pendente: <strong>{brl(r.pendente)}</strong></span>}
                      {r.vencido  > 0 && <span className="text-destructive">Vencido: <strong>{brl(r.vencido)}</strong></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.pacotesAtivos > 0 && (
                      <Badge variant="secondary">{r.pacotesAtivos} pacote{r.pacotesAtivos > 1 ? "s" : ""} ativo{r.pacotesAtivos > 1 ? "s" : ""}</Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
