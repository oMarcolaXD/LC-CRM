import { prisma }      from "@/lib/prisma"
import { notFound }    from "next/navigation"
import { PrintButton } from "./print-button"
import Link            from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"
import { formatBR, nowBrazil } from "@/lib/datetime"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

const METHOD_LABEL: Record<string, string> = {
  PIX:      "PIX",
  CARTAO:   "Cartão",
  BOLETO:   "Boleto",
  DINHEIRO: "Dinheiro",
}

interface ReciboPageProps {
  params: Promise<{ id: string }>
}

export default async function ReciboPage({ params }: ReciboPageProps) {
  const { id } = await params

  const payment = await prisma.payment.findUnique({
    where:   { id },
    include: { student: { include: { user: true } } },
  })

  if (!payment || payment.status !== "PAID") notFound()

  const receiptNumber = payment.id.slice(-8).toUpperCase()
  const emittedAt     = formatBR(nowBrazil(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const paidAt        = payment.paidAt
    ? format(payment.paidAt, "dd/MM/yyyy", { locale: ptBR })
    : "–"

  return (
    <>
      {/* Estilos de impressão — ocultam a navegação do sistema */}
      <style>{`
        @media print {
          [data-sidebar], header, nav, aside, .print-hide { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Barra de ações (não imprime) */}
      <div className="print:hidden flex items-center justify-between mb-6 gap-4">
        <Link href="/colaborador/financeiro"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Financeiro
        </Link>
        <PrintButton />
      </div>

      {/* Recibo */}
      <div className="print-page max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-border p-8 space-y-6">
        {/* Cabeçalho */}
        <div className="text-center space-y-1 border-b pb-6">
          <p className="font-heading text-3xl text-primary tracking-tight">LIÇÃO DE CASA</p>
          <p className="text-xs text-muted-foreground">Aulas Particulares</p>
          <p className="text-xs text-muted-foreground">Emitido em {emittedAt}</p>
        </div>

        {/* Título */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">Recibo de Pagamento</p>
            <p className="text-xs text-muted-foreground">Nº {receiptNumber}</p>
          </div>
        </div>

        {/* Dados */}
        <div className="space-y-3">
          <Row label="Aluno"       value={payment.student.name ?? "Aluno"} />
          <Row label="Descrição"   value={payment.description ?? "Pagamento de aulas"} />
          <Row label="Valor"       value={brl(Number(payment.amount))} bold />
          <Row label="Forma de pagamento"
               value={payment.method ? (METHOD_LABEL[payment.method] ?? payment.method) : "Não informado"} />
          <Row label="Data de pagamento" value={paidAt} />
        </div>

        {/* Linha divisória + rodapé */}
        <div className="border-t pt-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Este recibo confirma o recebimento do valor acima.
          </p>
          <p className="text-xs text-muted-foreground">
            Lição de Casa — espacolicao@gmail.com
          </p>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-sm text-right ${bold ? "font-bold text-primary text-base" : "font-medium"}`}>{value}</p>
    </div>
  )
}
