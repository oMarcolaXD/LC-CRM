import { prisma }         from "@/lib/prisma"
import { PageHeader }     from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }          from "@/components/ui/badge"
import { Button }         from "@/components/ui/button"
import { Input }          from "@/components/ui/input"
import { Label }          from "@/components/ui/label"
import { createPackageAction } from "@/lib/actions/financeiro"
import { PackageStatusButton } from "./package-status-button"
import { BookOpen, Plus, AlertCircle } from "lucide-react"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

const STATUS_CFG = {
  ACTIVE:    { label: "Ativo",     variant: "default"     as const },
  EXPIRED:   { label: "Expirado",  variant: "secondary"   as const },
  EXHAUSTED: { label: "Esgotado",  variant: "destructive" as const },
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface PacotesPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function PacotesPage({ searchParams }: PacotesPageProps) {
  const { error, success } = await searchParams

  const [packages, students] = await Promise.all([
    prisma.lessonPackage.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { purchaseDate: "desc" },
      take:    100,
    }),
    prisma.student.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="PACOTES DE AULAS" backHref="/admin/financeiro"
        description="Crie e gerencie os pacotes de aulas dos alunos" />

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{decodeURIComponent(success)}</div>}
      {error   && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{decodeURIComponent(error)}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Novo Pacote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPackageAction} className="space-y-4">
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <select name="studentId" required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecione o aluno</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.user.name} — {s.grade}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="totalLessons">Nº de Aulas *</Label>
                  <Input id="totalLessons" name="totalLessons" type="number" min="1" placeholder="8" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerLesson">Valor/Aula (R$) *</Label>
                  <Input id="pricePerLesson" name="pricePerLesson" type="number" min="0" step="0.01" placeholder="80.00" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresInDays">Validade (dias)</Label>
                <Input id="expiresInDays" name="expiresInDays" type="number" min="1" placeholder="90 (deixe vazio = sem prazo)" />
              </div>
              <Button type="submit" className="w-full">Criar Pacote</Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Pacotes Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum pacote cadastrado</p>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg) => {
                  const total = Number(pkg.pricePerLesson) * pkg.totalLessons
                  const pct   = Math.round((pkg.remainingLessons / pkg.totalLessons) * 100)
                  return (
                    <div key={pkg.id} className="p-4 rounded-xl border border-border">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-medium text-sm">{pkg.student.user.name}</p>
                          <p className="text-xs text-muted-foreground">{pkg.student.grade}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={STATUS_CFG[pkg.status].variant}>{STATUS_CFG[pkg.status].label}</Badge>
                          <PackageStatusButton id={pkg.id} current={pkg.status} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center text-xs">
                        <div className="bg-muted/50 rounded-lg py-2">
                          <p className="font-bold text-base">{pkg.totalLessons}</p>
                          <p className="text-muted-foreground">Total</p>
                        </div>
                        <div className="bg-primary/10 rounded-lg py-2">
                          <p className="font-bold text-base text-primary">{pkg.remainingLessons}</p>
                          <p className="text-muted-foreground">Restantes</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg py-2">
                          <p className="font-bold text-base">{brl(total)}</p>
                          <p className="text-muted-foreground">Valor total</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso</span><span>{pct}% restante</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {pkg.expiresAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Expira: {format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
