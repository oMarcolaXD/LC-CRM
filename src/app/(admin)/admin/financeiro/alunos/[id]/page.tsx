import { prisma }     from "@/lib/prisma"
import { situacao, type SituacaoCobranca } from "@/lib/payments"
import { nowBrazil }  from "@/lib/datetime"
import { notFound }   from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }      from "@/components/ui/badge"
import { PaymentStatusSelector } from "@/app/(colaborador)/colaborador/alunos/[id]/_components/payment-status-selector"
import { LinkToPackage } from "./link-to-package"
import { Package, Receipt, CalendarDays, Link2 } from "lucide-react"
import { format }     from "date-fns"
import { ptBR }       from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function fmtLessons(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",") }
function fmtDate(d: Date | null) { return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—" }

const PKG_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE:    { label: "Ativo",    variant: "default" },
  EXHAUSTED: { label: "Esgotado", variant: "secondary" },
  EXPIRED:   { label: "Expirado", variant: "destructive" },
}

interface Props { params: Promise<{ id: string }> }

export default async function AlunoFinanceiroPage({ params }: Props) {
  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { purchaseDate: "desc" },
        include: { payments: { orderBy: [{ installmentNumber: "asc" }, { dueDate: "asc" }] } },
      },
      payments: { orderBy: { dueDate: "desc" }, select: {
        id: true, amount: true, feeAmount: true, dueDate: true, paidAt: true,
        status: true, method: true, description: true, packageId: true,
        installmentNumber: true, installmentTotal: true, installmentGroupId: true,
      }},
    },
  })
  if (!student) notFound()

  const allPayments = student.payments
  // Situação derivada da data, não do status gravado (src/lib/payments.ts).
  const now  = nowBrazil()
  const soma = (sit: SituacaoCobranca) =>
    allPayments.filter((p) => situacao(p, now) === sit).reduce((t, p) => t + Number(p.amount), 0)
  const pago     = soma("PAID")
  const pendente = soma("PENDING")
  const vencido  = soma("OVERDUE")
  const taxas    = allPayments.filter((p) => p.status === "PAID").reduce((t, p) => t + Number(p.feeAmount ?? 0), 0)

  const avulsos = allPayments.filter((p) => !p.packageId)

  const kpis = [
    { title: "Pago",     value: brl(pago),     cls: "text-green-600" },
    { title: "Pendente", value: brl(pendente), cls: "text-amber-600" },
    { title: "Vencido",  value: brl(vencido),  cls: "text-destructive" },
    { title: "Taxas",    value: brl(taxas),    cls: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.name.toUpperCase()}
        description={`${student.grade} · Financeiro detalhado`}
        backHref="/admin/financeiro/alunos"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{k.title}</p>
              <p className={`text-lg font-bold font-sub mt-1 ${k.cls}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pacotes com seus pagamentos */}
      {student.packages.length === 0 && avulsos.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum pacote ou cobrança registrada para este aluno.
        </CardContent></Card>
      )}

      {student.packages.map((pkg) => {
        const total   = Number(pkg.totalLessons)
        const remain  = Number(pkg.remainingLessons)
        const price   = Number(pkg.pricePerLesson)
        const st      = PKG_STATUS[pkg.status] ?? PKG_STATUS.ACTIVE
        return (
          <Card key={pkg.id}>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Pacote de {fmtLessons(total)} aulas · {brl(price)}/aula
                </span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Adquirido em {fmtDate(pkg.purchaseDate)}</span>
                <span>Restam {fmtLessons(remain)}/{fmtLessons(total)} aulas</span>
                <span>Total {brl(total * price)}</span>
                {pkg.expiresAt && <span>Vence {fmtDate(pkg.expiresAt)}</span>}
              </p>
            </CardHeader>
            <CardContent>
              {pkg.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Sem cobranças vinculadas a este pacote.</p>
              ) : (
                <PaymentList payments={pkg.payments} />
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Cobranças avulsas (sem pacote) */}
      {avulsos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Cobranças avulsas
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — clique em <Link2 className="w-3 h-3 inline" /> para vincular ao pacote
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentList
              payments={avulsos}
              packages={student.packages.map((p) => ({
                id: p.id,
                totalLessons: Number(p.totalLessons),
                purchaseDate: p.purchaseDate,
                status: p.status,
              }))}
              studentId={id}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

type PaymentRow = {
  id: string; amount: unknown; feeAmount: unknown; dueDate: Date; paidAt: Date | null
  status: "PENDING" | "PAID" | "OVERDUE"; method: string | null; description: string | null
  installmentNumber: number | null; installmentTotal: number | null
  installmentGroupId?: string | null
}

interface PackageOption { id: string; totalLessons: number; purchaseDate: Date; status: string }

function PaymentList({
  payments, packages, studentId,
}: {
  payments: PaymentRow[]
  packages?: PackageOption[]
  studentId?: string
}) {
  return (
    <div className="space-y-2">
      {payments.map((p) => {
        const fee = Number(p.feeAmount ?? 0)
        return (
          <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {p.description ?? "Cobrança"}
                {p.installmentTotal && p.installmentTotal > 1 && (
                  <span className="text-muted-foreground font-normal"> · {p.installmentNumber}/{p.installmentTotal}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Vence {fmtDate(p.dueDate)}
                {p.paidAt && ` · Pago ${fmtDate(p.paidAt)}`}
                {p.method && ` · ${p.method}`}
                {fee > 0 && ` · taxa ${brl(fee)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-sm font-semibold">{brl(Number(p.amount))}</p>
              {packages && studentId && (
                <LinkToPackage
                  paymentId={p.id}
                  studentId={studentId}
                  packages={packages}
                  hasGroup={!!p.installmentGroupId}
                />
              )}
              <PaymentStatusSelector paymentId={p.id} currentStatus={p.status} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
