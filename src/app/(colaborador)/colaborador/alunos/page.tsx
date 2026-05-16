import { prisma }          from "@/lib/prisma"
import { PageHeader }      from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }           from "@/components/ui/badge"
import { buttonVariants }  from "@/components/ui/button"
import Link                from "next/link"
import { GraduationCap, BookOpen, MessageCircle, CalendarDays, AlertCircle, UserRound, Plus, Upload, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react"
import { format }          from "date-fns"
import { ptBR }            from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

function BalanceBadge({ remaining }: { remaining: number }) {
  if (remaining > 4) return (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      <BookOpen className="w-3 h-3 mr-1" />{remaining} aulas
    </Badge>
  )
  if (remaining > 1) return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
      <BookOpen className="w-3 h-3 mr-1" />{remaining} aulas
    </Badge>
  )
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      <AlertCircle className="w-3 h-3 mr-1" />{remaining} aula{remaining !== 1 ? "s" : ""}
    </Badge>
  )
}

const PAYMENT_CFG = {
  PENDING: { label: "Pendente", variant: "secondary"   as const },
  PAID:    { label: "Pago",     variant: "default"     as const },
  OVERDUE: { label: "Vencido",  variant: "destructive" as const },
}

interface AlunosPageProps {
  searchParams: Promise<{ success?: string }>
}

export default async function ColaboradorAlunosPage({ searchParams }: AlunosPageProps) {
  const { success } = await searchParams

  const students = await prisma.student.findMany({
    where:   { user: { active: true } },
    include: {
      user: true,
      guardian: { include: { user: true } },
      packages: {
        where:   { status: { in: ["ACTIVE", "EXHAUSTED"] } },
        orderBy: { purchaseDate: "desc" },
        take:    1,
      },
      lessons: {
        where:   { scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take:    1,
        include: { subject: true },
      },
      payments: {
        orderBy: { dueDate: "desc" },
        take:    1,
      },
    },
    orderBy: { user: { name: "asc" } },
  })

  const low    = students.filter((s) => (s.packages[0]?.remainingLessons ?? 0) <= 2)
  const normal = students.filter((s) => (s.packages[0]?.remainingLessons ?? 0) > 2)

  function StudentCard({ student }: { student: typeof students[number] }) {
    const pkg         = student.packages[0]
    const remaining   = pkg?.remainingLessons ?? 0
    const nextLesson  = student.lessons[0]
    const lastPayment = student.payments[0]
    const phone       = student.user.phone?.replace(/\D/g, "")
    const guardian    = student.guardian
    const guardianPhone = guardian?.user.phone?.replace(/\D/g, "")

    return (
      <div className="relative flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors cursor-pointer">
        <Link href={`/colaborador/alunos/${student.id}`} className="absolute inset-0 rounded-xl z-0" aria-label={`Ver perfil de ${student.user.name}`} />
        {/* Info principal */}
        <div className="flex gap-3 flex-1 min-w-0 relative z-10">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {/* Nome + saldo */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">{student.user.name}</p>
              <BalanceBadge remaining={remaining} />
            </div>

            {/* Responsável */}
            {guardian && (
              <div className="flex items-center gap-1.5">
                <UserRound className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Resp.: <span className="font-medium text-foreground">{guardian.user.name}</span>
                  {guardian.user.phone && (
                    <span className="text-muted-foreground"> · {guardian.user.phone}</span>
                  )}
                </p>
              </div>
            )}

            {/* Pacote */}
            {pkg ? (
              <p className="text-xs text-muted-foreground">
                Pacote: {pkg.totalLessons} aulas · {brl(Number(pkg.pricePerLesson))}/aula
                {pkg.expiresAt && ` · vence ${format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}`}
              </p>
            ) : (
              <p className="text-xs text-destructive">Sem pacote ativo</p>
            )}

            {/* Próxima aula */}
            {nextLesson && (
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Próx: {format(nextLesson.scheduledAt, "dd/MM HH:mm", { locale: ptBR })} · {nextLesson.subject.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="relative z-10 flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {lastPayment && (
            <Badge variant={PAYMENT_CFG[lastPayment.status].variant} className="text-xs">
              {PAYMENT_CFG[lastPayment.status].label}
            </Badge>
          )}
          {/* WhatsApp do aluno */}
          {phone && (
            <a href={`https://wa.me/55${phone}`} target="_blank" rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 h-8 text-xs px-2"}>
              <MessageCircle className="w-3 h-3 mr-1" />
              Aluno
            </a>
          )}
          {/* WhatsApp do responsável */}
          {guardianPhone && (
            <a href={`https://wa.me/55${guardianPhone}`} target="_blank" rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 h-8 text-xs px-2"}>
              <MessageCircle className="w-3 h-3 mr-1" />
              Resp.
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ALUNOS"
        description={`${students.length} aluno${students.length !== 1 ? "s" : ""} cadastrado${students.length !== 1 ? "s" : ""}`}
      />

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(success)}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Link href="/colaborador/alunos/importar"
          className={buttonVariants({ variant: "outline" }) + " gap-2"}>
          <Upload className="w-4 h-4" />
          Importar Alunos
        </Link>
        <Link href="/colaborador/alunos/novo"
          className={buttonVariants({ variant: "default" }) + " gap-2"}>
          <Plus className="w-4 h-4" />
          Novo Aluno
        </Link>
      </div>

      {/* Template de importação */}
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground list-none select-none">
          <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium">Template para importação em massa</span>
          <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 ml-1" />
          <span className="text-xs ml-auto">(clique para ver)</span>
        </summary>

        <Card className="mt-3 border-dashed">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Colunas do arquivo CSV / Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Prepare sua planilha com as colunas abaixo (a primeira linha deve ser o cabeçalho). Campos com <strong>*</strong> são obrigatórios.
            </p>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Coluna</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Obrigatório</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Formato / Exemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["nome",                "Sim",  "Lucas Oliveira"],
                    ["email",               "Sim",  "lucas@email.com"],
                    ["senha",               "Não",  "Padrão: Aluno@2025"],
                    ["telefone",            "Não",  "(11) 99999-0000"],
                    ["dataNascimento",       "Não",  "DD/MM/AAAA — ex: 15/03/2010"],
                    ["serie",               "Não",  "9º Ano EF · 2º Ano EM · Graduação"],
                    ["escola",              "Não",  "Colégio São Paulo"],
                    ["nomeResponsavel",      "Não",  "Maria Oliveira"],
                    ["telefoneResponsavel",  "Não",  "(11) 99999-0001"],
                    ["emailResponsavel",     "Não",  "maria@email.com"],
                  ].map(([col, req, ex]) => (
                    <tr key={col} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-primary">{col}</td>
                      <td className="px-3 py-2">{req === "Sim" ? <span className="text-destructive font-semibold">Sim</span> : <span className="text-muted-foreground">Não</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Linha de exemplo */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Exemplo de linha:</p>
              <div className="overflow-x-auto rounded-lg bg-muted/40 border border-border px-3 py-2">
                <code className="text-xs text-muted-foreground whitespace-nowrap">
                  nome,email,senha,telefone,dataNascimento,serie,escola,nomeResponsavel,telefoneResponsavel,emailResponsavel
                  <br />
                  Lucas Oliveira,lucas@email.com,Aluno@2025,(11) 99999-0000,15/03/2010,9º Ano EF,Colégio São Paulo,Maria Oliveira,(11) 99999-0001,maria@email.com
                </code>
              </div>
            </div>

            <Link href="/colaborador/alunos/importar"
              className={buttonVariants({ variant: "default", size: "sm" }) + " gap-2 w-full sm:w-auto"}>
              <Upload className="w-3.5 h-3.5" />
              Ir para importação
            </Link>
          </CardContent>
        </Card>
      </details>

      {/* Alunos com saldo baixo */}
      {low.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              Saldo Baixo ou Esgotado
              <Badge variant="destructive">{low.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {low.map((s) => <StudentCard key={s.id} student={s} />)}
          </CardContent>
        </Card>
      )}

      {/* Todos os alunos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            Todos os Alunos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {students.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <GraduationCap className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado</p>
              <Link href="/colaborador/alunos/novo"
                className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Plus className="w-4 h-4 mr-1" /> Cadastrar primeiro aluno
              </Link>
            </div>
          )}
          {normal.map((s) => <StudentCard key={s.id} student={s} />)}
        </CardContent>
      </Card>
    </div>
  )
}
